// Main-thread side of the inference worker. One worker per page lifetime, shared by every component
// (module singleton: survives React StrictMode double mounts and client-side route changes).
import { RUNTIME } from '../runtime.generated';

const BOOT_TIMEOUT = 12000;   // worker script never started: blocked or failed to load
const QUIET_TIMEOUT = 20000;  // no progress for this long: tell the user, keep waiting

const initial = Object.freeze({
  status: 'idle',            // idle | starting | loading | ready | error
  stage: null,               // runtime | download | restore | init
  loaded: 0,
  total: RUNTIME.model.totalBytes,
  network: 0,
  restored: false,
  slow: false,
  isolated: null,
  info: null,                // ready message: engine, threads, loadMs, offline, maxTokens ...
  error: null,               // { code, message }
});

let state = initial;
let worker = null;
let seq = 0;
let lastOptions = {};
const pending = new Map();
const listeners = new Set();
let bootTimer = 0;
let quietTimer = 0;
let readyWaiters = [];
let autoRepaired = false;

function set(patch) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const modelStore = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  get: () => state,
  server: () => initial,
};

class ModelError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function settleReady(err) {
  const ws = readyWaiters;
  readyWaiters = [];
  for (const w of ws) err ? w.reject(err) : w.resolve();
}

function fail(code, message) {
  clearTimeout(bootTimer);
  clearTimeout(quietTimer);
  const err = new ModelError(code, message);
  for (const p of pending.values()) p.reject(err);
  pending.clear();
  worker?.terminate();
  worker = null;
  set({ status: 'error', error: { code, message }, slow: false });
  settleReady(err);
}

function armQuiet() {
  clearTimeout(quietTimer);
  if (state.slow) set({ slow: false });
  quietTimer = setTimeout(() => set({ slow: true }), QUIET_TIMEOUT);
}

function onMessage({ data: m }) {
  if (m.type === 'boot') {
    clearTimeout(bootTimer);
    set({ isolated: m.isolated });
    return;
  }
  if (m.type === 'progress') {
    armQuiet();
    if (m.stage === 'init') return set({ status: 'loading', stage: 'init' });
    const restored = m.restored ?? state.restored;
    return set({
      status: 'loading',
      stage: restored ? 'restore' : 'download',
      restored,
      loaded: m.loaded ?? state.loaded,
      total: m.total ?? state.total,
      network: m.network ?? state.network,
    });
  }
  if (m.type === 'ready') {
    clearTimeout(quietTimer);
    try { localStorage.setItem(SEEN, RUNTIME.model.base); } catch { /* storage blocked: asks again next time */ }
    set({ status: 'ready', stage: null, info: m, slow: false, error: null, loaded: state.total });
    settleReady();
    return;
  }
  if (m.type === 'fatal') {
    // this device's stored copy was damaged (the worker already deleted it): fetch a fresh one once, unasked
    if (m.code === 'integrity' && state.restored && !autoRepaired) {
      autoRepaired = true;
      return retryModel({ repair: true });
    }
    return fail(m.code, m.message);
  }
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  if (m.type === 'error') p.reject(new ModelError(m.code, m.message));
  else p.resolve({ ...m, roundTripMs: performance.now() - p.t });
}

function capability() {
  if (typeof Worker === 'undefined') return 'Web Workers are not available in this browser.';
  if (typeof WebAssembly !== 'object') return 'WebAssembly is not available in this browser (it may be disabled by a policy or by Lockdown Mode).';
  return null;
}

const SEEN = 'kinthread-model';

/** True when this device already finished loading this model version (it starts quietly); otherwise the visitor is asked first. */
export function modelOnDevice() {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(SEEN) === RUNTIME.model.base; } catch { return false; }
}

/** Starts the worker and model download once. Later calls do nothing while it is loading or ready. */
export function startModel(options = {}) {
  if (typeof window === 'undefined') return;
  if (worker && state.status !== 'error') return;
  lastOptions = options;
  const missing = capability();
  if (missing) return set({ status: 'error', error: { code: 'unsupported', message: missing } });
  set({ ...initial, status: 'starting', stage: 'runtime' });
  try {
    worker = new Worker(`${RUNTIME.runtime}worker.js`, { type: 'module', name: 'kinthread' });
  } catch (e) {
    return fail('unsupported', `This browser cannot start module workers (${e.message}).`);
  }
  worker.onmessage = onMessage;
  worker.onerror = (e) => {
    e.preventDefault?.();
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (state.status === 'ready') fail('crashed', e.message || 'The model runtime stopped unexpectedly.');
    else fail(offline ? 'network' : 'runtime', e.message || 'The model runtime could not start.');
  };
  worker.onmessageerror = () => fail('runtime', 'The model runtime sent a message this page could not read.');
  bootTimer = setTimeout(() => fail(navigator.onLine === false ? 'network' : 'runtime',
    'The model runtime did not start. A browser extension or network filter may be blocking it.'), BOOT_TIMEOUT);
  armQuiet();
  worker.postMessage({ type: 'init', model: RUNTIME.model, engine: options.engine || 'auto', repair: !!options.repair, maxThreads: 4 });
}

/** Restarts from scratch. repair: re-download model files; engine 'single': skip threads (less memory). */
export function retryModel(options = {}) {
  worker?.terminate();
  worker = null;
  startModel({ ...lastOptions, ...options });
}

export function whenReady() {
  if (state.status === 'ready') return Promise.resolve();
  if (state.status === 'error') return Promise.reject(new ModelError(state.error.code, state.error.message));
  return new Promise((resolve, reject) => readyWaiters.push({ resolve, reject }));
}

function request(msg) {
  return new Promise((resolve, reject) => {
    if (!worker || state.status !== 'ready') return reject(new ModelError('not-ready', 'The model is not ready yet.'));
    const id = ++seq;
    pending.set(id, { resolve, reject, t: performance.now() });
    worker.postMessage({ ...msg, id });
  });
}

/** People found by the name model, plus the story's length in model tokens. */
export const detectPeople = (story, extra = []) => request({ type: 'names', story, extra });

/** How is b related to a? Resolves to { result, trace, roundTripMs }. */
export const askModel = (story, a, b, extra = []) => request({ type: 'ask', story, a, b, extra });
