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
  if (model.updateAvailable && (model.status === 'starting' || model.status === 'loading')) {   // downloading by itself
    const pct = model.total ? Math.min(99, Math.floor((model.loaded / model.total) * 100)) : 0;
    return (
      <aside className={`container ${s.notice}`} aria-live="polite">
        <p><strong>Updating to {model.latestReleaseId || RUNTIME.release.releaseId}{pct ? ` (${pct}%)` : ''}.</strong> The previous model is removed once the new one is ready.</p>
      </aside>
    );
  }
  const message = model.releaseMismatch
    ? <><strong>A newer Kinthread release is ready.</strong> Download it to keep solving with the latest model.</>
    : model.releaseCheckError
      ? <><strong>Couldn&rsquo;t verify the latest model.</strong> Check your connection, then try the download again.</>
      : <><strong>{model.latestReleaseId || RUNTIME.release.releaseId} is available.</strong> Download the latest model for this device.</>;
  return (
    <aside className={`container ${s.notice}`} aria-live="polite">
      <p>{message}</p>
      <button type="button" onClick={(e) => {
        if (window.location.pathname === '/') requestModel(e.currentTarget, { update: true });
        else router.push('/?updateModel=1#workbench');
      }}>Download latest model</button>
    </aside>
  );
}
