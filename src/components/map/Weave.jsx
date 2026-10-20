'use client';
import Constellation from '@/components/three/Constellation';
import { mb, mbText } from '@/lib/format';
import s from './Weave.module.css';

// The one loading design, used by the first-visit window and the map panel alike: the family is shown faintly and is
// woven together, thread by thread, as the model arrives.
export function WeaveStage({ progress, children, className, onWoven }) {
  return (
    <div className={`${s.wrap} ${className || ''}`}>
      <div className={s.stage}><Constellation variant="weave" progress={progress} className={s.weave} onWoven={onWoven} /></div>
      <div className={s.copy}>{children}</div>
    </div>
  );
}

export const downloadPct = (model) =>
  model.status === 'ready' ? 100 : model.total ? Math.min(100, (100 * model.loaded) / model.total) : 0;

// `shown` is the followed progress (useFollowedProgress): the same value the weave draws, so number and picture agree
export function DownloadStatus({ model, shown, onHide, woven = true }) {
  // "Ready" only once the picture is complete too, so the words never run ahead of the weave
  const ready = model.status === 'ready' && woven && shown >= 1;
  const pct = 100 * shown;
  // model ready but weave still finishing: stay on "Checking" (stage is cleared on ready; never fall back to "Downloading")
  const label = ready ? 'The model is on this device' : model.stage === 'init' || model.status === 'ready' ? 'Checking the model'
    : model.stage === 'retry' ? 'Connection lost, reconnecting\u2026' : 'Downloading the model';
  const detail = ready ? 'Kinthread works offline from here on.'
    : model.total ? `${mb(model.loaded)} of ${mbText(model.total)} · once, then it loads from this device` : 'Starting…';
  return (
    <>
      {/* keyed: "100%" cross-fades into "Ready" instead of being swapped */}
      <p key={ready ? 'ready' : 'count'} className={s.count} data-ready={ready || undefined} aria-hidden="true">{ready ? 'Ready' : <>{Math.floor(pct)}<span>%</span></>}</p>
      <p className={s.label} aria-live="polite">{label}</p>
      <p className={s.detail}>{detail}</p>
      <span className="visually-hidden" role="progressbar" aria-label="Model download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} />
      {onHide && !ready && <button type="button" className={s.quiet} onClick={onHide}>Hide and keep downloading</button>}
    </>
  );
}

export function AskCopy({ total, onStart, onLater, titleId }) {
  return (
    <>
      <h2 id={titleId} className={s.title}>One download, then it works offline.</h2>
      <p className={s.text}>
        Kinthread&rsquo;s AI runs on your device, so it needs its model first: {mbText(total)}, once. Wi-Fi is best.
        Your stories are never uploaded.
      </p>
      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={onStart} autoFocus={!!onLater}>Download and start</button>
        {onLater && <button type="button" className={s.quiet} onClick={onLater}>Not now</button>}
      </div>
    </>
  );
}

export { s as weaveStyles };
