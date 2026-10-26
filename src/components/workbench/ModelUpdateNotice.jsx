'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RUNTIME } from '@/lib/runtime.generated';
import { refreshModelState } from '@/lib/model/client';
import { useModel } from '@/lib/model/useModel';
import { requestModel } from '@/lib/model/gate';
import s from './ModelUpdateNotice.module.css';

export default function ModelUpdateNotice() {
  const router = useRouter();
  const model = useModel();
  useEffect(() => refreshModelState(), []);
  if (!model.releaseMismatch && !model.releaseCheckError && (!model.updateAvailable || model.status === 'ready')) return null;
  const reload = model.releaseMismatch || model.releaseCheckError;
  return (
    <aside className={`container ${s.notice}`} aria-live="polite">
      <p>{model.releaseMismatch
        ? <><strong>Reload Kinthread.</strong> The published model release differs from this page. Reload before using model files.</>
        : model.releaseCheckError
          ? <><strong>Couldn&rsquo;t verify the model release.</strong> Check your connection, then reload to try again.</>
          : <><strong>{RUNTIME.release.releaseId} is available.</strong> Update the model on this device to use the latest release.</>}</p>
      <button type="button" onClick={(e) => {
        if (reload) window.location.reload();
        else if (window.location.pathname === '/') requestModel(e.currentTarget);
        else router.push('/?updateModel=1#workbench');
      }}>{reload ? 'Reload page' : 'Update model'}</button>
    </aside>
  );
}
