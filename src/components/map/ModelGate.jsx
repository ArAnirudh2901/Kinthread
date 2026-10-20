'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Mark from '@/components/brand/Mark';
import Constellation from '@/components/three/Constellation';
import { mb, mbText } from '@/lib/format';
import { modelOnDevice, retryModel, startModel } from '@/lib/model/client';
import { useModel } from '@/lib/model/useModel';
import s from './ModelGate.module.css';

const noop = () => () => {};
// decided once per page load: the model arriving mid-visit must not close the window before it says "Ready"
let firstVisitCache;
const firstVisitNow = () => (firstVisitCache ??= !modelOnDevice());

// First visit: the model is not on this device yet. A full window where the family weaves itself together thread by
// thread as the model arrives: the download is the animation. Asks first, closes itself when ready.
export default function ModelGate() {
  const model = useModel();
  const firstVisit = useSyncExternalStore(noop, firstVisitNow, () => false);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef(null);
  const open = firstVisit && !dismissed;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    else if (!open && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
  }, [open]);

  useEffect(() => {
    if (!open || model.status !== 'ready') return;
    const t = setTimeout(() => setDismissed(true), 1600);
    return () => clearTimeout(t);
  }, [open, model.status]);

  const close = () => setDismissed(true);
  const busy = model.status === 'starting' || model.status === 'loading';
  const ready = model.status === 'ready';
  const pct = ready ? 100 : model.total ? Math.min(100, (100 * model.loaded) / model.total) : 0;
  const weave = ready ? 1 : busy ? pct / 100 : 0;   // 0: the whole family, faint, waiting to be woven
  const state = ready ? 'ready' : model.status === 'error' ? 'error' : busy ? 'busy' : 'ask';

  return (
    <dialog ref={ref} className={s.gate} data-state={state} aria-labelledby="gate-title" onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className={s.brand}><Mark size={26} /><span>Kinthread</span></div>

      <div className={s.stage}>
        {open && <Constellation variant="weave" progress={weave} className={s.weave} />}
      </div>

      {state === 'ask' && (
        <div className={s.copy}>
          <h2 id="gate-title" className={s.title}>One download, then it works offline.</h2>
          <p className={s.text}>
            Kinthread&rsquo;s AI runs on your device, so it needs its model first: {mbText(model.total)}, once.
            Wi-Fi is best. Your stories are never uploaded.
          </p>
          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={() => startModel()} autoFocus>Download and start</button>
            <button type="button" className={s.quiet} onClick={close}>Not now</button>
          </div>
        </div>
      )}

      {(state === 'busy' || state === 'ready') && (
        <div className={s.copy} aria-live="polite">
          <p className={s.count} aria-hidden="true">{ready ? 'Ready' : <>{Math.floor(pct)}<span>%</span></>}</p>
          <h2 id="gate-title" className={s.label}>{ready ? 'The model is on this device' : 'Downloading the model'}</h2>
          <p className={s.bytes}>
            {ready ? 'Kinthread works offline from here on.' : model.total ? `${mb(model.loaded)} of ${mbText(model.total)} · once, then it loads from this device` : 'Starting…'}
          </p>
          <span className="visually-hidden" role="progressbar" aria-label="Model download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} />
          {!ready && <button type="button" className={s.quiet} onClick={close}>Hide and keep downloading</button>}
        </div>
      )}

      {state === 'error' && (
        <div className={s.copy}>
          <h2 id="gate-title" className={s.title}>The model couldn&rsquo;t load.</h2>
          <p className={s.text}>{model.error?.message || 'Check the connection and try again.'}</p>
          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={() => retryModel()}>Try again</button>
            <button type="button" className={s.quiet} onClick={close}>Close</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
