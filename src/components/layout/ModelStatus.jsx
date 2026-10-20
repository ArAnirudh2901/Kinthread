'use client';
import { useModel } from '@/lib/model/useModel';
import s from './ModelStatus.module.css';

// Compact header indicator. The workbench carries the detailed, announced status.
export default function ModelStatus() {
  const model = useModel();
  if (model.status === 'idle') return null;
  let tone = 'busy';
  let text;
  if (model.status === 'ready') {
    tone = 'ready';
    text = model.info?.offline ? 'Ready · works offline' : 'Ready';
  } else if (model.status === 'error') {
    tone = 'error';
    text = 'Couldn\u2019t load';
  } else if (model.stage === 'download' && model.total) {
    text = `Downloading ${Math.floor((100 * model.loaded) / model.total)}%`;
  } else {
    text = model.stage === 'init' ? 'Getting ready' : 'Loading';
  }
  return (
    <span className={s.pill} data-tone={tone}>
      <span className={s.dot} aria-hidden="true" />
      {text}
    </span>
  );
}
