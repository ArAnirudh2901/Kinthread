// After `next build`: finish out/ for Cloudflare Pages.
//  - _headers: cross-origin isolation (threads), immutable caching for hashed files, security headers
//  - a CSP <meta> in every HTML page, with the exact hashes of that page's inline scripts
//  - sw.js: precaches the app shell (not the model, which the inference worker caches itself)
//  - checks Cloudflare's limits: 25 MiB per file, 20,000 files
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '../out');
const MAX_FILE = 25 * 1024 * 1024;

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else files.push(p);
  }
  return files;
}

const files = await walk(out);
const rel = (p) => `/${path.relative(out, p).split(path.sep).join('/')}`;

// 1. limits
let bytes = 0;
for (const f of files) {
  const { size } = await stat(f);
  bytes += size;
  if (size > MAX_FILE) throw new Error(`${rel(f)} is ${(size / 2 ** 20).toFixed(1)} MiB; Cloudflare Pages allows 25 MiB per file`);
}
if (files.length > 20000) throw new Error(`${files.length} files; Cloudflare Pages allows 20,000`);

// 2. CSP per page. WebAssembly compiles inside the worker (its own context), so pages need no eval.
const sha = (s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;
const html = files.filter((f) => f.endsWith('.html'));
for (const f of html) {
  let doc = await readFile(f, 'utf8');
  const hashes = new Set();
  for (const m of doc.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) hashes.add(sha(m[1]));
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  doc = doc.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  doc = /<meta charSet="utf-8"\/>/i.test(doc) ? doc.replace(/(<meta charSet="utf-8"\/>)/i, `$1${tag}`) : doc.replace(/<head>/, `<head>${tag}`);
  await writeFile(f, doc);
}

// 3. headers
const headers = `/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/r/*
  Cache-Control: public, max-age=31536000, immutable

/m/*
  Cache-Control: public, max-age=31536000, immutable

/model-release.json
  Cache-Control: no-cache, no-store, must-revalidate

/sw.js
  Cache-Control: no-cache
`;
await writeFile(path.join(out, '_headers'), headers);

// 4. service worker: app shell only; model parts (/m/) are cached by the inference worker
const shell = files
  .map(rel)
  .filter((p) => !p.startsWith('/m/') && !/\/(_headers|sw\.js|\.complete)$/.test(p) && !p.endsWith('.map'))
  .map((p) => p.replace(/\/index\.html$/, '/'));
const version = createHash('sha256');
for (const f of files.filter((x) => !rel(x).startsWith('/m/'))) version.update(rel(f)).update(await readFile(f));
const sw = (await readFile(path.join(import.meta.dirname, '../runtime/sw.js'), 'utf8'))
  .replace('__VERSION__', version.digest('hex').slice(0, 12))
  .replace('__SHELL__', JSON.stringify(shell));
await writeFile(path.join(out, 'sw.js'), sw);

console.log(`postbuild: ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB, ${html.length} pages with CSP, ${shell.length} files precached`);
