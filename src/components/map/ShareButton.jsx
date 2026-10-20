'use client';
import { useState } from 'react';
import { shareHash } from '@/lib/share';
import s from './StoryGraph.module.css';

// Copies (or, on phones, shares) a link that opens this question and solves it. The story travels in the #hash only.
export default function ShareButton({ share }) {
  const [state, setState] = useState('idle');   // idle | copied | manual
  const [link, setLink] = useState('');
  const flash = (st) => { setState(st); if (st !== 'manual') setTimeout(() => setState('idle'), 2000); };

  const onClick = async () => {
    const url = `${location.origin}${location.pathname}${shareHash(share)}`;
    setLink(url);
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: 'Kinthread', text: `How is ${share.b} related to ${share.a}?`, url }); return; }
      catch (e) { if (e?.name === 'AbortError') return; }   // closed the share sheet: nothing to do
    }
    // a permission prompt can leave writeText pending forever: give it a moment, then use the older path
    const within = (pr, ms) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
    try { await within(navigator.clipboard.writeText(url), 1200); flash('copied'); return; } catch { /* insecure page, denied or no answer */ }
    try {
      const ta = Object.assign(document.createElement('textarea'), { value: url, readOnly: true });
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) { flash('copied'); return; }
    } catch { /* fall through to showing the link */ }
    flash('manual');
  };

  return (
    <>
      <button type="button" className={s.download} data-state={state === 'copied' ? 'done' : undefined} onClick={onClick} aria-label="Share a link to this question" title="Copy a link that opens this question">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          {state === 'copied'
            ? <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
        </svg>
        <span>{state === 'copied' ? 'Link copied' : 'Share'}</span>
      </button>
      {state === 'manual' && (
        <input className={s.manualLink} readOnly value={link} aria-label="Link to this question: copy it" onFocus={(e) => e.target.select()} autoFocus />
      )}
      <span className="visually-hidden" aria-live="polite">{state === 'copied' ? 'Link copied.' : ''}</span>
    </>
  );
}
