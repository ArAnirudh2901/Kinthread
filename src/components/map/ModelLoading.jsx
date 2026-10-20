'use client';
import Mark from '@/components/brand/Mark';
import { requestModel } from '@/lib/model/gate';
import { useFollowedProgress } from '@/lib/useFollowedProgress';
import { AskCopy, DownloadStatus, WeaveStage } from './Weave';
import s from './ModelLoading.module.css';

function activeStep(model) {
  if (model.stage === 'init') return 2;
  if (model.stage === 'download' || model.stage === 'restore') return 1;
  return 0;
}

export default function ModelLoading({ model }) {
  // asked first (first visit, "Not now"): the same stage, waiting
  if (model.status === 'idle') {
    return (
      <div className={s.panel}>
        <WeaveStage progress={0}><AskCopy total={model.total} onStart={(e) => requestModel(e.currentTarget)} /></WeaveStage>
      </div>
    );
  }
  const step = activeStep(model);
  const restoring = model.stage === 'restore';
  const pct = model.total ? Math.min(100, (100 * model.loaded) / model.total) : 0;

  // returning visit: the files are already on this device, keep it short
  if (restoring || (step === 2 && model.restored)) {
    return (
      <div className={s.compact} role="status">
        <Mark size={34} animate="loop" className={s.mark} />
        <div>
          <p className={s.compactTitle}>Loading your local model…</p>
          <p className={s.note}>From this device. No download needed.</p>
        </div>
        <Bar pct={pct} determinate={step === 1} label="Loading model files from this device" />
      </div>
    );
  }

  // downloading: the same design as the loading window
  return (
    <div className={s.panel}>
      <FollowedWeave model={model} raw={step === 2 ? 1 : pct / 100} />
      {model.slow && (
        <p className={s.slow} role="status">
          This is taking longer than usual. A slow connection is the most likely cause; it will keep going.
        </p>
      )}
    </div>
  );
}

// the panel version of the loading window's stage: same followed value for the weave and the number
function FollowedWeave({ model, raw }) {
  const shown = useFollowedProgress(raw);
  return <WeaveStage progress={shown}><DownloadStatus model={model} shown={shown} /></WeaveStage>;
}

function Bar({ pct, determinate, label }) {
  return (
    <div
      className={s.bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(pct) : undefined}
      data-indeterminate={!determinate || undefined}
    >
      <span className={s.fill} style={determinate ? { transform: `scaleX(${pct / 100})` } : undefined} />
    </div>
  );
}
