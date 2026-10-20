'use client';
import Mark from '@/components/brand/Mark';
import Constellation from '@/components/three/Constellation';
import { mb, mbText } from '@/lib/format';
import { startModel } from '@/lib/model/client';
import s from './ModelLoading.module.css';

const STEPS = ['runtime', 'files', 'init'];

function activeStep(model) {
  if (model.stage === 'init') return 2;
  if (model.stage === 'download' || model.stage === 'restore') return 1;
  return 0;
}

export default function ModelLoading({ model }) {
  // phones / data saver: nothing downloads until the visitor agrees
  if (model.status === 'idle') {
    return (
      <div className={s.ask}>
        <Mark size={40} className={s.mark} />
        <h3 className={`display ${s.title}`}>One download, then it works offline.</h3>
        <p className={s.lede}>
          Kinthread solves puzzles on your device, so it needs its AI model first: {mbText(model.total)}, once.
          Wi-Fi is best. Your stories are never uploaded.
        </p>
        <button type="button" className={s.start} onClick={() => startModel()}>Download and start</button>
      </div>
    );
  }
  const step = activeStep(model);
  const restoring = model.stage === 'restore';
  const pct = model.total ? Math.min(100, (100 * model.loaded) / model.total) : 0;
  const determinate = step === 1 && model.total > 0;
  const labels = [
    'Start the WebAssembly runtime',
    restoring ? 'Load model files from this device' : `Download model files (${mbText(model.total)})`,
    'Verify and start both models',
  ];

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

  return (
    <div className={s.loading}>
      {/* 3D: the family graph weaves itself together as the model downloads */}
      <Constellation variant="weave" progress={step === 2 ? 1 : pct / 100} className={s.weave} />
      <h3 className={`display ${s.title}`}>Preparing your local AI.</h3>
      <p className={s.lede}>
        Kinthread is downloading its models to this device. Once setup is complete, you can run relationship checks
        locally, without an inference server.
      </p>

      <Bar pct={pct} determinate={determinate} label="Model download" />
      <p className={`mono ${s.bytes}`} aria-hidden="true">
        {determinate ? `${mb(model.loaded)} of ${mbText(model.total)}` : step === 2 ? 'Download complete' : 'Starting…'}
      </p>

      <ol className={s.steps}>
        {STEPS.map((k, i) => (
          <li key={k} data-state={i < step ? 'done' : i === step ? 'active' : 'todo'}>
            <span className={s.stepIcon} aria-hidden="true" />
            <span>{labels[i]}</span>
            <span className="visually-hidden">{i < step ? '(done)' : i === step ? '(in progress)' : ''}</span>
          </li>
        ))}
      </ol>

      <p className={s.note}>
        One-time setup. Later visits load from this device in about a second, unless the browser clears its storage.
        Every file is checked before the model uses it.
      </p>
      {model.slow && (
        <p className={s.slow} role="status">
          This is taking longer than usual. A slow connection is the most likely cause; it will keep going.
        </p>
      )}
      <div className="visually-hidden" aria-live="polite">{labels[step]}</div>
    </div>
  );
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
