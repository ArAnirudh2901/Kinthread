'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Mark from '@/components/brand/Mark';
import { modelOnDevice, retryModel, startModel } from '@/lib/model/client';
import { useFollowedProgress } from '@/lib/useFollowedProgress';
import { useModel } from '@/lib/model/useModel';
import { AskCopy, DownloadStatus, WeaveStage, downloadPct, weaveStyles as w } from './Weave';
import s from './ModelGate.module.css';

const noop = () => () => {};
// decided once per page load: the model arriving mid-visit must not close the window before it says "Ready"
let firstVisitCache;
const firstVisitNow = () => (firstVisitCache ??= !modelOnDevice());

// The loading window, the same on every device: full screen. It opens on a first visit (asking first) and whenever
// the model really comes over the network (a cleared or unavailable cache). A quick load from the device shows nothing.
export default function ModelGate() {
  const model = useModel();
  const firstVisit = useSyncExternalStore(noop, firstVisitNow, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [shownForDownload, setShownForDownload] = useState(false);
  const [woven, setWoven] = useState(false);
  const ref = useRef(null);
  const downloading = model.status === 'loading' && model.stage === 'download';
  const open = !dismissed && (firstVisit || downloading || shownForDownload);

  // once opened for a download, stay open through checking and "Ready"
  if (downloading && !shownForDownload) setShownForDownload(true);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    else if (!open && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
  }, [open]);

  useEffect(() => {
    if (!open || model.status !== 'ready' || !woven) return;   // close only once the weave is complete
    const t = setTimeout(() => setDismissed(true), 1400);
    return () => clearTimeout(t);
  }, [open, model.status, woven]);

  const close = () => setDismissed(true);
  const busy = model.status === 'starting' || model.status === 'loading';
  const ready = model.status === 'ready';
  const state = ready && woven ? 'ready' : model.status === 'error' ? 'error' : busy || ready ? 'busy' : 'ask';   // ready but still weaving: keep counting
  // one value drives the weave and the number: the download, followed smoothly (never ahead, never backwards)
  const progress = useFollowedProgress(ready ? 1 : busy ? downloadPct(model) / 100 : 0);

  return (
    <dialog ref={ref} className={s.gate} data-state={state} aria-labelledby="gate-title" onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className={s.brand}><Mark size={26} /><span id="gate-title">Kinthread</span></div>
      {open && (
        <WeaveStage progress={progress} onWoven={() => setWoven(true)}>
          {state === 'ask' && <AskCopy total={model.total} onStart={() => startModel()} onLater={close} />}
          {(state === 'busy' || state === 'ready') && <DownloadStatus model={model} shown={progress} onHide={close} woven={woven} />}
          {state === 'error' && (
            <>
              <h2 className={w.title}>The model couldn&rsquo;t load.</h2>
              <p className={w.text}>{model.error?.message || 'Check the connection and try again.'}</p>
              <div className={w.actions}>
                <button type="button" className={w.primary} onClick={() => retryModel()}>Try again</button>
                <button type="button" className={w.quiet} onClick={close}>Close</button>
              </div>
            </>
          )}
        </WeaveStage>
      )}
    </dialog>
  );
}
