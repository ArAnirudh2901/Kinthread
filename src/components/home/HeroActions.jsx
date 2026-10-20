'use client';
import Link from 'next/link';
import { scrollToTarget } from '@/lib/smooth-scroll';
import { modelStore } from '@/lib/model/client';
import { requestModel } from '@/lib/model/gate';
import s from './HeroActions.module.css';

// Primary: load an example and bring the workbench into view (Workbench listens for 'kinthread:example').
export default function HeroActions() {
  const tryIt = (e) => {
    window.dispatchEvent(new CustomEvent('kinthread:example', { detail: 'short' }));
    const toBench = () => scrollToTarget(document.getElementById('workbench'));
    // first time: the model window grows out of this button, and the page moves to the answer after it closes
    if (modelStore.get().status !== 'ready') requestModel(e.currentTarget, { then: toBench });
    else toBench();
  };
  return (
    <div className={s.actions}>
      <button type="button" className={s.primary} onClick={tryIt}>
        <span>Try an example</span>
        <span className={s.icon} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 3v9M4 8.5 8 12.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      <Link href="/how-it-works/" className={s.secondary}>How it works</Link>
    </div>
  );
}
