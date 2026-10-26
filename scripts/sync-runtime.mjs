// Builds one content-addressed v10 release and its isolated browser runtime.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { releaseIdentityMatches } from './release-identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const src = path.resolve(process.env.KINSHIP_SRC || path.join(root, '../../Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM'));
const VENDOR = path.join(root, 'vendor/kinship');
const FALLBACK_MODEL = path.join(VENDOR, 'v10-model');
const web = existsSync(path.join(src, 'web/reader.js')) ? path.join(src, 'web') : path.join(FALLBACK_MODEL, 'runtime');
const exportDir = path.resolve(process.env.KINSHIP_V10_EXPORT || (existsSync(path.join(src, 'web/v10/manifest.json')) ? path.join(src, 'web/v10') : FALLBACK_MODEL));
const PART_BYTES = 2 * 1024 * 1024;
const RELEASE = { releaseId: 'v10-r8p', checkpoint: 'runs/v10-r8p-final/best.pt', checkpointSha256: '38c289d351d6517b5cde1bc9fb64ea97bd33eee193639d6351edda52fdfd7a52' };
const MODEL_NAMES = ['reader.json', 'verifier.json', 'FINAL.json', 'name_table.tsv.gz', 'kinlogic.zip'];
const PYODIDE_NAMES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const fail = (msg) => { console.error(`sync-runtime: ${msg}`); process.exit(1); };

const exportManifest = JSON.parse(await readFile(path.join(exportDir, 'manifest.json'), 'utf8').catch(() => fail(`no v10 export manifest at ${exportDir}`)));
const releaseFile = JSON.parse(await readFile(path.join(exportDir, 'release.json'), 'utf8').catch(() => fail('v10 export is missing release.json')));
if (!releaseIdentityMatches(releaseFile, RELEASE)) fail(`release identity does not match ${RELEASE.releaseId} and the selected checkpoint`);
const model = {};
for (const name of MODEL_NAMES) {
  const want = exportManifest.files?.[name];
  if (!want) fail(`v10 export manifest has no entry for ${name}`);
  const buf = await readFile(path.join(exportDir, name)).catch(() => fail(`v10 export file is missing: ${name}`));
  if (buf.length !== want.bytes || sha256(buf) !== want.sha256) fail(`${name} differs from its v10 export manifest`);
  model[name] = buf;
}
let weights = [];
let weightBytes = 0;
let weightSha256 = '';
if (existsSync(path.join(exportDir, 'reader.bin.gz'))) {
  const want = exportManifest.files?.['reader.bin.gz'];
  if (!want) fail('v10 export manifest has no reader.bin.gz entry');
  const gz = await readFile(path.join(exportDir, 'reader.bin.gz'));
  if (gz.length !== want.bytes || sha256(gz) !== want.sha256) fail('reader.bin.gz differs from its v10 export manifest');
  weightBytes = gz.length;
  weightSha256 = sha256(gz);
  for (let i = 0, k = 0; i < gz.length; i += PART_BYTES, k++) weights.push({ file: `reader.${k}.bin`, bytes: gz.subarray(i, i + PART_BYTES) });
} else {
  const want = exportManifest.weights;
  if (!want?.parts?.length) fail('vendored v10 export has no split reader weights');
  weightBytes = want.bytes;
  weightSha256 = want.sha256;
  const combined = createHash('sha256');
  for (const part of want.parts) {
    const buf = await readFile(path.join(exportDir, part.file)).catch(() => fail(`v10 weight part is missing: ${part.file}`));
    if (buf.length !== part.bytes || sha256(buf) !== part.sha256) fail(`${part.file} differs from its v10 weight manifest`);
    combined.update(buf);
    weights.push({ file: path.basename(part.file), bytes: buf });
  }
  if (weights.reduce((n, p) => n + p.bytes.length, 0) !== weightBytes || combined.digest('hex') !== weightSha256) fail('split v10 reader weights do not match the original gzip hash');
}
const meta = JSON.parse(model['reader.json']);
if (meta.arch !== 'v10' || meta.checkpoint?.step !== 6000) fail('reader metadata is not the selected v10-r8p step-6000 export');

const runtime = {};
for (const name of ['reader.js', 'reader-scalar.mjs', 'reader-scalar.wasm', 'reader-simd.mjs', 'reader-simd.wasm',
  'reader-scalar-mt.mjs', 'reader-scalar-mt.wasm', 'reader-simd-mt.mjs', 'reader-simd-mt.wasm', 'kinship.js']) {
  runtime[name] = await readFile(path.join(web, name)).catch(() => fail(`v10 runtime file is missing: ${name}`));
}
for (const name of ['worker.js', 'v10-decoder.js', 'v10-pipeline.js', 'file-integrity.js']) runtime[name] = await readFile(path.join(root, 'runtime', name));
runtime['fflate.js'] = await readFile(path.join(root, 'node_modules/fflate/esm/browser.js'));
for (const name of PYODIDE_NAMES) runtime[`pyodide/${name}`] = await readFile(path.join(root, 'node_modules/pyodide', name)).catch(() => fail(`Pyodide runtime file is missing: ${name}`));

const files = {}, mFiles = {};
let totalBytes = 0;
function addFile(key, filename, bytes) {
  mFiles[filename] = bytes;
  files[key] = { json: { file: filename, bytes: bytes.length, sha256: sha256(bytes) }, parts: [], bytes: bytes.length };
  totalBytes += bytes.length;
}
const parts = [];
for (const part of weights) {
  mFiles[part.file] = part.bytes;
  parts.push({ file: part.file, bytes: part.bytes.length, sha256: sha256(part.bytes) });
}
addFile('reader', 'reader.json', model['reader.json']);
files.reader.parts = parts;
files.reader.bytes = weightBytes;
totalBytes += weightBytes;
for (const [key, filename] of [['verifier', 'verifier.json'], ['final', 'FINAL.json'], ['nameTable', 'name_table.tsv.gz'], ['logic', 'kinlogic.zip']]) addFile(key, filename, model[filename]);

const digest = (items) => sha256(Object.keys(items).sort().map((k) => `${k}:${sha256(items[k])}`).join('\n')).slice(0, 12);
const runtimeHash = digest(runtime), modelHash = digest(mFiles);
const modelDescriptor = {
  version: RELEASE.releaseId, releaseId: RELEASE.releaseId, arch: 'v10', blockSize: meta.config.block_size,
  contentHash: modelHash, base: `/m/${modelHash}/`, files, totalBytes,
};
const release = { ...RELEASE, contentHash: modelHash, modelBase: `/m/${modelHash}/`, runtimeHash,
  runtime: `/r/${runtimeHash}/`, model: modelDescriptor,
  files: Object.fromEntries(Object.entries(mFiles).map(([file, buf]) => [file, { bytes: buf.length, sha256: sha256(buf) }])) };

async function writeDir(kind, version, contents) {
  const base = path.join(root, 'public', kind);
  await mkdir(base, { recursive: true });
  for (const d of await readdir(base)) if (d !== version) await rm(path.join(base, d), { recursive: true, force: true });
  const dir = path.join(base, version);
  if (existsSync(path.join(dir, '.complete'))) {
    for (const [name, expected] of Object.entries(contents)) {
      const actual = await readFile(path.join(dir, name)).catch(() => fail(`generated ${kind}/${version}/${name} is missing`));
      if (actual.length !== expected.length || sha256(actual) !== sha256(expected)) fail(`generated ${kind}/${version}/${name} failed size or SHA-256 verification`);
    }
    return false;
  }
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [name, buf] of Object.entries(contents)) {
    const target = path.join(dir, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buf);
  }
  await writeFile(path.join(dir, '.complete'), '');
  return true;
}

await writeDir('r', runtimeHash, runtime);
await writeDir('m', modelHash, mFiles);
const generated = {
  runtime: `/r/${runtimeHash}/`, release,
  model: modelDescriptor,
  facts: { qa: { params: meta.floats, ...meta.config, relations: meta.grammar.relations }, tagger: { params: 0, n_layer: 0, n_head: 0, n_embd: 0, block_size: meta.config.block_size, vocab_size: 0, config: 'v10 built-in name parser' } },
};
await mkdir(path.join(root, 'src/lib'), { recursive: true });
await writeFile(path.join(root, 'src/lib/runtime.generated.js'), `// Generated by scripts/sync-runtime.mjs. Do not edit.\nexport const RUNTIME = ${JSON.stringify(generated, null, 2)};\n`);
await writeFile(path.join(root, 'public/model-release.json'), `${JSON.stringify(release, null, 2)}\n`);

const vendorFiles = {};
for (const [name, buf] of Object.entries(model)) vendorFiles[`v10-model/${name}`] = buf;
for (const part of weights) vendorFiles[`v10-model/weights/${part.file}`] = part.bytes;
vendorFiles['v10-model/release.json'] = Buffer.from(`${JSON.stringify(RELEASE, null, 2)}\n`);
const vendorExportManifest = {
  release: RELEASE,
  files: Object.fromEntries(Object.entries(model).map(([name, buf]) => [name, { bytes: buf.length, sha256: sha256(buf) }])),
  weights: { bytes: weightBytes, sha256: weightSha256,
    parts: weights.map((part) => ({ file: `weights/${part.file}`, bytes: part.bytes.length, sha256: sha256(part.bytes) })) },
};
vendorFiles['v10-model/manifest.json'] = Buffer.from(`${JSON.stringify(vendorExportManifest, null, 2)}\n`);
for (const [name, buf] of Object.entries(runtime)) vendorFiles[`v10-model/runtime/${name}`] = buf;
const vendorManifest = { note: 'SHA-256 of v10-r8p export and browser runtime; checked by scripts/sync-runtime.mjs', release: RELEASE,
  files: Object.fromEntries(Object.entries(vendorFiles).map(([name, buf]) => [name, { bytes: buf.length, sha256: sha256(buf) }])) };
await writeFile(path.join(VENDOR, 'manifest.json'), `${JSON.stringify(vendorManifest, null, 2)}\n`);
await rm(FALLBACK_MODEL, { recursive: true, force: true });
for (const [name, buf] of Object.entries(vendorFiles)) {
  const target = path.join(VENDOR, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buf);
}
const mb = (n) => (n / 1e6).toFixed(1);
console.log(`sync-runtime: ${RELEASE.releaseId} | runtime ${runtimeHash} | model ${modelHash} | ${parts.length} verified parts | ${mb(totalBytes)} MB model`);
