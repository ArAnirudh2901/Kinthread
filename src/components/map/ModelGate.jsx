'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Mark from '@/components/brand/Mark';
import { mb, mbText } from '@/lib/format';
import { modelOnDevice, retryModel, startModel } from '@/lib/model/client';
import { useModel } from '@/lib/model/useModel';
import s from './ModelGate.module.css';

const noop = () => () => {};

// First visit: the model is not on this device yet. A window says so, asks before the one-time download,
// shows its progress, and closes itself when the model is ready. Returning visitors never see it.
export default function ModelGate() {
  const model = useModel();
  const firstVisit = useSyncExternalStore(noop, () => !modelOnDevice(), () => false);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef(null);
  const open = firstVisit && !dismissed;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    else if (!open && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
  }, [open]);

  // ready: show it for a moment, then get out of the way
  useEffect(() => {
    if (!open || model.status !== 'ready') return;
    const t = setTimeout(() => setDismissed(true), 1400);
    return () => clearTimeout(t);
  }, [open, model.status]);

  const close = () => setDismissed(true);
  const pct = model.total ? Math.min(100, (100 * model.loaded) / model.total) : 0;
  const busy = model.status === 'starting' || model.status === 'loading';

  return (
    <dialog ref={ref} className={s.gate} aria-labelledby="gate-title" onCancel={(e) => { e.preventDefault(); close(); }}>
      <Mark size={40} animate={busy ? 'loop' : 'none'} className={s.mark} />
      {model.status === 'ready' ? (
        <>
          <h2 id="gate-title" className={s.title}>Ready.</h2>
          <p className={s.text}>The model is on this device now. Kinthread works offline from here on.</p>
          <div className={s.actions}><button type="button" className={s.primary} onClick={close}>Start</button></div>
        </>
      ) : model.status === 'error' ? (
        <>
          <h2 id="gate-title" className={s.title}>The model couldn&rsquo;t load.</h2>
          <p className={s.text}>{model.error?.message || 'Check the connection and try again.'}</p>
          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={() => retryModel()}>Try again</button>
            <button type="button" className={s.secondary} onClick={close}>Close</button>
          </div>
        </>
      ) : busy ? (
        <>
          <h2 id="gate-title" className={s.title}>Downloading the model&hellip;</h2>
          <div className={s.bar} role="progressbar" aria-label="Model download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <span className={s.fill} style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <p className={s.bytes}>{model.total ? `${mb(model.loaded)} of ${mbText(model.total)}` : 'Starting…'}</p>
          <p className={s.text}>This happens once; later visits load in about a second. You can hide this and write a story meanwhile.</p>
          <div className={s.actions}><button type="button" className={s.secondary} onClick={close}>Hide and keep downloading</button></div>
        </>
      ) : (
        <>
          <h2 id="gate-title" className={s.title}>One download, then it works offline.</h2>
          <p className={s.text}>
            Kinthread&rsquo;s AI runs on your device, so it needs its model first: {mbText(model.total)}, once.
            Wi-Fi is best. Your stories are never uploaded.
          </p>
          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={() => startModel()} autoFocus>Download and start</button>
            <button type="button" className={s.secondary} onClick={close}>Not now</button>
          </div>
        </>
      )}
    </dialog>
  );
}
