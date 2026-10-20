'use client';
import Link from 'next/link';
import { engineName, ms } from '@/lib/format';
import { useModel } from '@/lib/model/useModel';
import s from './content.module.css';

// Numbers from this visit, next to the reference measurements in the build log.
export default function LiveStats() {
  const model = useModel();
  if (model.status !== 'ready') {
    return (
      <p className={s.note}>
        Load the model on the <Link href="/">workbench</Link> and come back to see the numbers measured on this device.
      </p>
    );
  }
  const i = model.info;
  return (
    <div className={s.callout}>
      <p>
        <strong>This device, this visit:</strong> {engineName(i)}; models ready in {ms(i.loadMs)}
        {i.restored ? ' from local storage' : ' including the download'}
        {i.offline ? '; saved for offline use.' : '.'}
      </p>
    </div>
  );
}
