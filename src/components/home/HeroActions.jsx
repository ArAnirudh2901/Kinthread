'use client';
import Link from 'next/link';
import s from './HeroActions.module.css';

// Primary: load an example and bring the workbench into view (Workbench listens for 'kinthread:example').
export default function HeroActions() {
  const tryIt = () => {
    window.dispatchEvent(new CustomEvent('kinthread:example', { detail: 'short' }));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('workbench')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
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
