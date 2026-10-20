// Inference worker. Served unbundled from /r/<hash>/ next to kinship.js and the WASM engines.
// Loads both models once per worker, then answers requests. Weights come from Cache Storage when present;
// otherwise each part is downloaded, checked against its SHA-256, and cached for offline use.
//
// main -> worker                                   worker -> main
//   {type:'init', model, engine?, repair?}           {type:'boot', isolated, cores}
//   {type:'names', id, story, extra}                 {type:'progress', stage, loaded?, total?, restored?}
//   {type:'ask', id, story, a, b, extra}             {type:'ready', engine, threads, ...}
//                                                    {type:'fatal', code, message}
//                                                    {type:'names'|'result'|'error', id, ...}
import { KinshipQA, bestEngine, bracketNames } from './kinship.js';

const CACHE_PREFIX = 'kinship-model-';
let qa = null;
let starting = false;
const post = (msg) => self.postMessage(msg);

class LoadError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function classify(e) {
  if (e instanceof LoadError) return e.code;
  const m = String(e?.message || e);
  if (e instanceof RangeError || /out of memory|OOM|Cannot enlarge memory|allocation failed/i.test(m)) return 'memory';
  if (/corrupt|truncated|damaged|decompress|CRC|incorrect header|invalid|unexpected end/i.test(m)) return 'integrity';
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return 'network';
  return 'init';
}

// Browsers without DecompressionStream (Safari < 16.4, Firefox < 113) unpack with fflate instead.
async function ensureGunzip() {
  if (typeof DecompressionStream !== 'undefined') return 'native';
  if (typeof TransformStream === 'undefined') throw new LoadError('unsupported', 'This browser cannot stream-decompress files.');
  const { Gunzip } = await import('./fflate.js');
  globalThis.DecompressionStream = class {
    constructor() {
      let gz;
      const ts = new TransformStream({
        start(ctrl) { gz = new Gunzip((chunk) => ctrl.enqueue(chunk)); },
        transform(chunk) { gz.push(chunk); },
        flush() { gz.push(new Uint8Array(0), true); },
      });
      this.readable = ts.readable;
      this.writable = ts.writable;
    }
  };
  return 'fflate';
}

async function openCache(version) {
  try { return await caches.open(CACHE_PREFIX + version); }
  catch { return null; }   // no Cache API (private mode, insecure origin): download every visit
}

async function dropCache(version) {
  try { await caches.delete(CACHE_PREFIX + version); } catch { /* nothing cached */ }
}

async function dropOldCaches(version) {
  try {
    for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== CACHE_PREFIX + version) await caches.delete(k);
  } catch { /* nothing cached */ }
}

const allFiles = (model) => Object.values(model.files).flatMap((f) => [f.json, ...f.parts]);

async function isCached(model, cache) {
  for (const f of allFiles(model)) if (!(await cache.match(model.base + f.file).catch(() => null))) return false;
  return true;
}

async function sha256(buf) {
  if (!globalThis.crypto?.subtle) return null;   // insecure origin: the engine's CRC32 still checks the weights
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  let s = '';
  for (const b of d) s += b.toString(16).padStart(2, '0');
  return s;
}

function limiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active++;
    const [fn, ok, fail] = queue.shift();
    fn().then(ok, fail).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((ok, fail) => { queue.push([fn, ok, fail]); next(); });
}

function tracker(total) {
  let loaded = 0, network = 0, last = 0;
  return (n, fromNetwork) => {
    loaded += n;
    if (fromNetwork) network += n;
    const now = performance.now();
    if (now - last > 90 || loaded >= total) {
      last = now;
      post({ type: 'progress', stage: 'download', loaded, total, network });
    }
  };
}

async function download(url, size, ctx) {
  let res;
  try { res = await fetch(url, { cache: ctx.repair ? 'reload' : 'default' }); }
  catch (e) { throw new LoadError('network', `Could not download ${url} (${e.message}).`); }
  if (!res.ok) throw new LoadError(res.status === 404 ? 'missing' : 'network', `${url} returned HTTP ${res.status}.`);
  const buf = new Uint8Array(size);
  let n = 0;
  const take = (chunk) => {
    if (n + chunk.length > size) throw new LoadError('integrity', `${url} is larger than expected.`);
    buf.set(chunk, n);
    n += chunk.length;
    ctx.progress(chunk.length, true);
  };
  if (!res.body) take(new Uint8Array(await res.arrayBuffer()));
  else {
    const reader = res.body.getReader();
    for (;;) {
      let r;
      try { r = await reader.read(); }
      catch (e) { throw new LoadError('network', `Download of ${url} was interrupted (${e.message}).`); }
      if (r.done) break;
      take(r.value);
    }
  }
  if (n !== size) throw new LoadError('integrity', `${url} is incomplete (${n} of ${size} bytes).`);
  return buf;
}

async function getFile(f, ctx) {
  const url = ctx.model.base + f.file;
  if (ctx.cache && !ctx.repair) {
    const hit = await ctx.cache.match(url).catch(() => null);
    if (hit) {
      const buf = new Uint8Array(await hit.arrayBuffer());
      if (buf.length === f.bytes) { ctx.progress(buf.length, false); return buf; }
    }
  }
  const buf = await download(url, f.bytes, ctx);
  const sum = await sha256(buf);
  if (sum && sum !== f.sha256) throw new LoadError('integrity', `${f.file} arrived damaged (checksum mismatch).`);
  if (ctx.cache) {
    ctx.puts.push(ctx.cache.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } }))
      .catch(() => { ctx.cacheFailed = true; }));
  }
  return buf;
}

// Weights for one model: parts fetched in parallel, handed to kinship.js in order as one gzip stream.
function weightsResponse(entry, ctx) {
  const pending = entry.parts.map((p) => ctx.limit(() => getFile(p, ctx)));
  pending.forEach((p) => p.catch(() => {}));   // reported through the stream below
  let i = 0;
  return new Response(new ReadableStream({
    async pull(ctrl) {
      if (i === pending.length) {
        ctrl.close();
        if (++ctx.streamsDone === 2) post({ type: 'progress', stage: 'init' });
        return;
      }
      try { ctrl.enqueue(await pending[i++]); }
      catch (e) { ctx.error ??= e; ctrl.error(e); }
    },
  }));
}

async function route(name, ctx) {
  const m = /^(qa|tagger)\.(json|bin\.gz)$/.exec(name);
  if (!m) throw new LoadError('init', `Unexpected model file ${name}.`);
  const entry = ctx.model.files[m[1]];
  if (m[2] === 'bin.gz') return weightsResponse(entry, ctx);
  try { return new Response(await getFile(entry.json, ctx)); }
  catch (e) { ctx.error ??= e; throw e; }
}

async function init({ model, engine = 'auto', repair = false, maxThreads = 4 }) {
  if (qa) return post(qa.readyMsg);
  if (starting) return;
  starting = true;
  const t0 = performance.now();
  const ctx = { model, repair, cache: null, limit: limiter(3), puts: [], error: null, streamsDone: 0, cacheFailed: false };
  try {
    if (typeof WebAssembly !== 'object') throw new LoadError('unsupported', 'WebAssembly is not available in this browser.');
    const gunzip = await ensureGunzip();
    if (repair) await dropCache(model.version);
    ctx.cache = await openCache(model.version);
    const restored = !!ctx.cache && !repair && await isCached(model, ctx.cache);
    post({ type: 'progress', stage: restored ? 'restore' : 'download', loaded: 0, total: model.totalBytes, restored });
    ctx.progress = tracker(model.totalBytes);
    const kind = engine === 'single' ? bestEngine().replace(/-mt$/, '') : engine;
    qa = await KinshipQA.load({ base: '', fetchFn: (name) => route(name, ctx), engine: kind, maxThreads });
    await Promise.allSettled(ctx.puts);
    const offline = !!ctx.cache && !ctx.cacheFailed && await isCached(model, ctx.cache);
    dropOldCaches(model.version);
    qa.readyMsg = {
      type: 'ready', engine: qa.engine, threads: qa.threads, tile: qa.tile, gunzip, restored, offline,
      loadMs: performance.now() - t0, maxTokens: qa.qa.cfg.block_size - 16,
    };
    post(qa.readyMsg);
  } catch (e) {
    qa = null;
    const err = ctx.error && classify(e) !== 'memory' ? ctx.error : e;
    const code = classify(err);
    if (code === 'integrity') await dropCache(model.version);   // only this model's files; next try downloads fresh
    post({ type: 'fatal', code, message: String(err?.message || err) });
  } finally {
    starting = false;
  }
}

function budget(story, people) {
  const ex = { story: bracketNames(story, people), a: people[0] ?? '', b: people[1] ?? people[0] ?? '' };
  return qa.viewTokens(ex, 0).ids.length;
}

function names({ id, story, extra = [] }) {
  if (!qa) return post({ type: 'error', id, code: 'not-ready', message: 'The model is not ready yet.' });
  try {
    const t = performance.now();
    const found = story.trim() ? qa.findNames(story) : [];
    const people = [...new Set([...found, ...extra])];
    post({ type: 'names', id, people, found, tokens: story.trim() ? budget(story, people) : 0, ms: performance.now() - t });
  } catch (e) {
    post({ type: 'error', id, code: 'names', message: String(e?.message || e) });
  }
}

// What the model actually reads: the tokenized question with names replaced by entity ids.
function trace(story, people, a, b, steps) {
  const { ids, names: ent } = qa.viewTokens({ story: bracketNames(story, people), a, b }, 0);
  const byName = Object.fromEntries(ent);
  return {
    tokens: ids.map((i) => qa.qa.vocab[i]),
    entities: Object.fromEntries([...ent].map(([n, t]) => [t, n])),
    chain: steps.map((s) => s.split(/\s+/).map((w) => byName[w] || w).join(' ')),
  };
}

function ask({ id, story, a, b, extra = [] }) {
  if (!qa) return post({ type: 'error', id, code: 'not-ready', message: 'The model is not ready yet.' });
  try {
    const { perView, ...r } = qa.ask(story, a, b, { names: extra });
    void perView;
    const withTrace = r.kind === 'answer' || r.kind === 'not sure' || (r.kind === 'unknown' && r.relation);
    post({ type: 'result', id, result: r, trace: withTrace ? trace(story, r.people, a, b, r.steps || []) : null });
  } catch (e) {
    post({ type: 'error', id, code: 'inference', message: String(e?.message || e) });
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') init(data);
  else if (data.type === 'names') names(data);
  else if (data.type === 'ask') ask(data);
};

post({ type: 'boot', isolated: !!self.crossOriginIsolated, cores: navigator.hardwareConcurrency || 1 });
