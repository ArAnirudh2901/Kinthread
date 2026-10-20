// Copies the inference runtime and model files from the LLM repo into public/ under content-hashed folders:
//   public/r/<hash>/  worker.js, kinship.js, WASM engines, fflate (gzip fallback)
//   public/m/<hash>/  qa.json, tagger.json, weights split into parts
// Hashed paths let every file be cached forever and stop old weights from mixing with new runtime code.
// Source: the LLM repo (KINSHIP_SRC) when present, else the copy committed in vendor/kinship/ (a fresh clone).
// Every file is checked against a SHA-256 manifest before anything is copied, so a damaged checkout never ships.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.resolve(process.env.KINSHIP_SRC || path.join(root, '../../Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM'));
const VENDOR = path.join(root, 'vendor/kinship');
// Cloudflare Pages rejects files over 25 MiB; parts also download in parallel.
const PART_BYTES = 16 * 1024 * 1024;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const fail = (msg) => { console.error(`sync-runtime: ${msg}`); process.exit(1); };

const MODEL_FILES = ['qa.json', 'qa.bin.gz', 'tagger.json', 'tagger.bin.gz'];
const fromRepo = existsSync(path.join(src, 'web'));
const web = fromRepo ? path.join(src, 'web') : VENDOR;
const vendorManifest = path.join(VENDOR, 'manifest.json');
let manifest;
if (fromRepo) {
  manifest = JSON.parse(await readFile(path.join(src, 'model_manifest.json'), 'utf8'));
} else {
  // fresh clone: verify every committed file byte for byte
  if (!existsSync(vendorManifest)) fail(`no LLM repo at ${src} and no vendor/kinship/manifest.json`);
  const vm = JSON.parse(await readFile(vendorManifest, 'utf8'));
  for (const [name, want] of Object.entries(vm.files)) {
    const buf = await readFile(path.join(VENDOR, name)).catch(() => fail(`vendor/kinship/${name} is missing`));
    if (buf.length !== want.bytes || sha256(buf) !== want.sha256) {
      fail(`vendor/kinship/${name} is corrupted (size or SHA-256 differs from manifest.json). ` +
        'Restore it with `git checkout -- vendor/kinship` or clone again; if you use Git LFS or line-ending filters, ' +
        'make sure they are off for this folder (.gitattributes marks it binary).');
    }
  }
  manifest = Object.fromEntries(MODEL_FILES.map((n) => [`web/model/${n}`, vm.files[`model/${n}`]]));
}

// 1. integrity of the source model files
const model = {};
for (const name of MODEL_FILES) {
  const key = `web/model/${name}`, want = manifest[key];
  if (!want) fail(`${key} missing from model_manifest.json`);
  const buf = await readFile(path.join(web, 'model', name)).catch(() => fail(`${key} not found (run export_web.py)`));
  if (buf.length !== want.bytes || sha256(buf) !== want.sha256) fail(`${key} is corrupted or does not match model_manifest.json`);
  model[name] = buf;
}

// 2. runtime files
const engines = (await readdir(web)).filter((f) => /^engine.*\.(mjs|wasm)$/.test(f)).sort();
if (engines.length !== 12) fail(`expected 6 engine builds (.mjs + .wasm) in ${web}, found ${engines.length} files`);
const runtime = {
  'kinship.js': await readFile(path.join(web, 'kinship.js')),
  'worker.js': await readFile(path.join(root, 'runtime/worker.js')),
  'fflate.js': await readFile(path.join(root, 'node_modules/fflate/esm/browser.js')),
};
for (const f of engines) runtime[f] = await readFile(path.join(web, f));

// the LLM repo refreshes the committed copy in vendor/kinship/ (commit it after a model change)
if (fromRepo) {
  const pinned = {};
  const copy = {};
  for (const [f, buf] of Object.entries(runtime)) if (f !== 'worker.js' && f !== 'fflate.js') copy[f] = buf;
  for (const [f, buf] of Object.entries(model)) copy[`model/${f}`] = buf;
  for (const [f, buf] of Object.entries(copy)) pinned[f] = { bytes: buf.length, sha256: sha256(buf) };
  const text = `${JSON.stringify({ note: 'SHA-256 of every file in this folder; checked by scripts/sync-runtime.mjs', files: pinned }, null, 2)}\n`;
  if (!existsSync(vendorManifest) || (await readFile(vendorManifest, 'utf8')) !== text) {
    await rm(VENDOR, { recursive: true, force: true });
    await mkdir(path.join(VENDOR, 'model'), { recursive: true });
    for (const [f, buf] of Object.entries(copy)) await writeFile(path.join(VENDOR, f), buf);
    await writeFile(vendorManifest, text);
    console.log('sync-runtime: vendor/kinship updated from the LLM repo: commit it');
  }
}

const digest = (files) => sha256(Object.keys(files).sort().map((k) => `${k}:${sha256(files[k])}`).join('\n')).slice(0, 12);
const rVer = digest(runtime), mVer = digest(model);

// 3. model parts
const files = {};
let totalBytes = 0;
const mFiles = {};
for (const name of ['qa', 'tagger']) {
  const gz = model[`${name}.bin.gz`], parts = [];
  for (let i = 0, k = 0; i < gz.length; i += PART_BYTES, k++) {
    const part = gz.subarray(i, i + PART_BYTES);
    const file = `${name}.${k}.bin`;
    mFiles[file] = part;
    parts.push({ file, bytes: part.length, sha256: sha256(part) });
  }
  mFiles[`${name}.json`] = model[`${name}.json`];
  const json = model[`${name}.json`];
  files[name] = { json: { file: `${name}.json`, bytes: json.length, sha256: sha256(json) }, parts, bytes: gz.length };
  totalBytes += gz.length + model[`${name}.json`].length;
}

// 4. write (skipped when the hashed folder already exists), drop stale versions
async function writeDir(kind, ver, contents) {
  const base = path.join(root, 'public', kind);
  await mkdir(base, { recursive: true });
  for (const d of await readdir(base)) if (d !== ver) await rm(path.join(base, d), { recursive: true, force: true });
  const dir = path.join(base, ver);
  if (existsSync(path.join(dir, '.complete'))) return false;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [f, buf] of Object.entries(contents)) await writeFile(path.join(dir, f), buf);
  await writeFile(path.join(dir, '.complete'), '');
  return true;
}
const wroteR = await writeDir('r', rVer, runtime);
const wroteM = await writeDir('m', mVer, mFiles);

const qaMeta = JSON.parse(model['qa.json']), tagMeta = JSON.parse(model['tagger.json']);
const generated = {
  runtime: `/r/${rVer}/`,
  model: { version: mVer, base: `/m/${mVer}/`, files, totalBytes },
  facts: {
    qa: { params: qaMeta.floats, ...qaMeta.config, relations: qaMeta.relations },
    tagger: { params: tagMeta.floats, ...tagMeta.config },
  },
};
await mkdir(path.join(root, 'src/lib'), { recursive: true });
await writeFile(path.join(root, 'src/lib/runtime.generated.js'),
  `// Generated by scripts/sync-runtime.mjs. Do not edit.\nexport const RUNTIME = ${JSON.stringify(generated, null, 2)};\n`);

const mb = (x) => (x / 1e6).toFixed(1);
console.log(`sync-runtime: runtime ${rVer}${wroteR ? ' (written)' : ''} | model ${mVer}${wroteM ? ' (written)' : ''} | ` +
  `${Object.values(files).reduce((n, f) => n + f.parts.length, 0)} parts, ${mb(totalBytes)} MB`);
