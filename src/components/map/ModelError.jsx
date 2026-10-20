'use client';
import { retryModel } from '@/lib/model/client';
import { RUNTIME } from '@/lib/runtime.generated';
import { mb, mbText } from '@/lib/format';
import s from './results.module.css';

// One entry per error code the worker or client can report.
const COPY = {
  network: {
    title: 'Couldn’t download the model.',
    text: 'Check your connection, then try again. Files already saved on this device are kept.',
    actions: [['Try again', {}]],
  },
  missing: {
    title: 'The model files are missing from this site.',
    text: 'This deployment looks incomplete. Trying again may help if it was just updated.',
    actions: [['Try again', {}]],
  },
  integrity: {
    title: 'A model file is damaged.',
    text: 'Kinthread checks every file before using it, and this one failed the check. The damaged copy was discarded; downloading it again usually fixes this.',
    actions: [[`Download again (${mbText(RUNTIME.model.totalBytes)})`, { repair: true }]],
  },
  memory: {
    title: 'This device ran out of memory loading the model.',
    text: 'Close a few tabs and try again, or use the lighter single-threaded mode, which needs about half the memory.',
    actions: [['Use lighter mode', { engine: 'single' }], ['Try again', {}]],
  },
  unsupported: {
    title: 'This browser can’t run the local model.',
    text: 'Kinthread needs WebAssembly and module Web Workers: Chrome or Edge 80+, Firefox 114+, or Safari 15+. Lockdown Mode and some enterprise policies turn WebAssembly off.',
    actions: [],
  },
  runtime: {
    title: 'The model runtime didn’t start.',
    text: 'A content blocker or a strict network filter may be blocking it. Reloading the page or allowing this site usually fixes it.',
    actions: [['Try again', {}]],
  },
  crashed: {
    title: 'The model stopped unexpectedly.',
    text: 'Your story is still here. Restarting loads the model again from this device.',
    actions: [['Restart the model', {}]],
  },
  init: {
    title: 'Something went wrong while starting the model.',
    text: 'Trying again usually works. If it keeps happening, the technical details below explain what failed.',
    actions: [['Try again', {}], ['Download again', { repair: true }]],
  },
};

export default function ModelError({ error }) {
  const c = COPY[error.code] || COPY.init;
  return (
    <div className={s.error} role="alert">
      <p className={s.badge} data-tone="attention">Model unavailable</p>
      <h3 className={`display ${s.headline}`}>{c.title}</h3>
      <p className={s.lede}>{c.text}</p>
      {c.actions.length > 0 && (
        <div className={s.actions}>
          {c.actions.map(([label, opts], i) => (
            <button key={label} type="button" className={i === 0 ? s.primary : s.secondary} onClick={() => retryModel(opts)}>{label}</button>
          ))}
        </div>
      )}
      <details className={s.tech}>
        <summary>Technical details</summary>
        <pre>{`${error.code}: ${error.message}`}</pre>
      </details>
    </div>
  );
}
