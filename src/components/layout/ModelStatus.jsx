'use client';
import { useRef } from 'react';
import { useModel } from '@/lib/model/useModel';
import { useShapeMorph } from '@/lib/useShapeMorph';
import s from './ModelStatus.module.css';

// Compact header indicator. The workbench carries the detailed, announced status.
export default function ModelStatus() {
  const model = useModel();
  const ref = useRef(null);
  useShapeMorph(ref, `${model.status}|${model.stage}`);
  if (model.status === 'idle') return null;
  let tone = 'busy';
  let text, fill = null;
  if (model.status === 'ready') {
    tone = 'ready';
    text = model.info?.offline ? 'Ready · works offline' : 'Ready';
  } else if (model.status === 'error') {
    tone = 'error';
    text = 'Couldn\u2019t load';
  } else if (model.stage === 'download' && model.total) {
    fill = model.loaded / model.total;
    text = `Downloading ${Math.floor(100 * fill)}%`;
  } else {
    text = model.stage === 'init' ? 'Getting ready' : 'Loading';
  }
  return (
    <span ref={ref} className={`${s.pill} morph`} data-tone={tone}>
      {fill != null && <span className={s.fill} style={{ transform: `scaleX(${fill})` }} aria-hidden="true" />}
      <span className={s.dot} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
