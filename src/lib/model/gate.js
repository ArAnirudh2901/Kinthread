// The model window is asked for by a control (Solve, an example, Download): it grows out of that control and
// shrinks back into it. This store holds the request; ModelGate renders it.
import { startModel } from './client';

let request = null, open = false, seq = 0, lastPressed = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // remember what was pressed, so requests from code (Ctrl+Enter, an example event) still grow from a control
  addEventListener('pointerdown', (e) => { lastPressed = e.target?.closest?.('button, a, [role="button"]') || null; }, true);
}

/** Open the model window from `from` (an element) and start the download. `then` runs after it closes. */
export function requestModel(from, { then, update = false } = {}) {
  const el = from || lastPressed || document.querySelector('[data-solve]');
  request = { id: ++seq, from: el?.isConnected ? el : null, then, update };
  emit();
  startModel({ update });
}

export function setGateOpen(v) {
  if (open === v) return;
  open = v;
  emit();
}

export const gateStore = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  request: () => request,
  open: () => open,
  serverRequest: () => null,
  serverOpen: () => false,
};
