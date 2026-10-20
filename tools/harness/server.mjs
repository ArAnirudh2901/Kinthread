// Local test server for the self-reporting browser harness: serves the built site (out/) with the same
// isolation headers as Cloudflare, plus /__<name>.html harness pages from this folder. Pages POST their
// results here; they are appended to result.jsonl (git-ignored).
//   node tools/harness/server.mjs [outDir] [port]   then open http://127.0.0.1:8791/__solve.html
import { appendFile, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(process.argv[2] || path.join(here, '../../out'));
const port = +process.argv[3] || 8791;
const slow = +process.env.SLOW || 0;   // ms per MB for model parts (/m/): mimics a phone connection
// network profile for model parts, switchable at runtime by a harness page (POST /__profile):
// { rate: KB/s per stream, jitter: 0-1, stallEvery: KB, stallMs, latency: ms before the first byte }
let profile = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.gz': 'application/octet-stream' };

createServer(async (req, res) => {
  // no X-Frame-Options: the harness loads the site in iframes at several widths
  const h = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-store' };
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/__profile') {
    let body = '';
    for await (const c of req) body += c;
    profile = body ? JSON.parse(body) : null;
    res.writeHead(204, h).end();
    return;
  }
  if (req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    await appendFile(path.join(here, 'result.jsonl'), body + '\n');
    res.writeHead(204, h).end();
    return;
  }
  const page = /^\/__([a-z]+)\.html$/.exec(url.pathname);
  let p = page ? path.join(here, `${page[1]}.html`) : path.join(root, decodeURIComponent(url.pathname));
  if (!p.startsWith(root) && !p.startsWith(here)) { res.writeHead(403, h).end(); return; }
  try {
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    const buf = await readFile(p);
    res.writeHead(200, { ...h, 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Content-Length': buf.length });
    if (profile && url.pathname.startsWith('/m/')) {
      const { rate = 1e6, jitter = 0, stallEvery = 0, stallMs = 0, latency = 0 } = profile;
      if (latency) await sleep(latency);
      const chunk = 64 * 1024;
      let sinceStall = 0;
      for (let i = 0; i < buf.length; i += chunk) {
        if (res.destroyed) return;
        res.write(buf.subarray(i, i + chunk));
        const factor = 1 + jitter * (Math.random() * 2 - 1);
        await sleep(((chunk / 1024) / rate) * 1000 * Math.max(0.05, factor));
        sinceStall += chunk / 1024;
        if (stallEvery && sinceStall >= stallEvery) { sinceStall = 0; await sleep(stallMs); }
      }
      res.end();
      return;
    }
    if (!slow || !url.pathname.startsWith('/m/')) { res.end(buf); return; }
    for (let i = 0; i < buf.length; i += 1 << 20) { res.write(buf.subarray(i, i + (1 << 20))); await new Promise((r) => setTimeout(r, slow)); }
    res.end();
  } catch {
    res.writeHead(404, h).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log('listening', port, 'serving', root));
