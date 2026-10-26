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
