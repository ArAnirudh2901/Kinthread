'use client';
import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { workedSteps } from '@/lib/worked';
import s from './StepCaption.module.css';

// Subtitles for the map: the step on screen, in words, right under the picture.
// Decorative duplicate of the step list (which screen readers use), so hidden from assistive tech.
// play (a triangle cut in two) and pause (two bars): four points each, in the same order, so one morphs into the other
const PLAY = ['M5 3.2 L8.75 5.6 L8.75 10.4 L5 12.8 Z', 'M8.75 5.6 L12.5 8 L12.5 8 L8.75 10.4 Z'];
const PAUSE = ['M4.5 3.5 L7 3.5 L7 12.5 L4.5 12.5 Z', 'M9 3.5 L11.5 3.5 L11.5 12.5 L9 12.5 Z'];

export default function StepCaption({ run, tentative, progress, player }) {
  const el = useRef(null);
  const { rows } = workedSteps(run, tentative);
  const k = progress ? Math.min(progress.step, rows.length - 1) : rows.length - 1;
  const row = rows[k];
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    // the caption swaps its words with a short blur, in place
    gsap.fromTo(el.current, { autoAlpha: 0, filter: 'blur(4px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.28, ease: 'power3.out', clearProps: 'filter' });
  }, { dependencies: [k, run.id], scope: el });
  // at the end the headline below gives the answer, so the caption shows the working instead
  const label = row.tone === 'question' ? 'The question' : row.tone === 'answer' ? (row.sum ? 'Putting it together' : tentative ? 'Best guess' : 'The answer') : `Step ${row.badge} of ${rows.length - 2}`;
  const last = rows.length - 1;
  const playing = !!progress?.playing;
  const ctl = (fn) => () => player.current?.[fn]();
  return (
    <div className={s.wrap}>
    <div ref={el} className={s.caption} data-tone={row.tone} aria-hidden="true">
      <span className={s.badge}>{row.tone === 'answer' ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : row.badge}</span>
      <span className={s.text}>
        <span className={s.label}>{label}</span>
        <span className={s.main}>{row.tone === 'question' ? row.text.replace(/^The question: /, '') : row.sum || row.text.replace(/^(Answer|Best guess): /, '')}</span>
        {row.so && <span className={s.so}>{row.so}</span>}
      </span>
    </div>
    <div className={s.controls} role="group" aria-label="Step through the answer">
      <span className={s.count} aria-hidden="true"><span key={k} className={s.swapIn}>{k + 1}</span> / {rows.length}</span>
      <button type="button" className={s.ctl} onClick={ctl('replay')} aria-label="Replay from the start" title="Replay">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.5v2.4h2.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className={s.ctl} onClick={ctl('prev')} disabled={k === 0} aria-label="Previous step" title="Previous step">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className={s.ctl} onClick={ctl(playing ? 'pause' : 'play')} aria-label={playing ? 'Pause' : k === last ? 'Play again' : 'Play'} title={playing ? 'Pause' : 'Play'}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" className={s.pp}>
          {(playing ? PAUSE : PLAY).map((d, i) => <path key={i} d={d} style={{ d: `path("${d}")` }} fill="currentColor" />)}
        </svg>
      </button>
      <button type="button" className={s.ctl} onClick={ctl('next')} disabled={k === last} aria-label="Next step" title="Next step">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className={s.skip} onClick={ctl('skip')} disabled={k === last} aria-label="Show the answer">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3.5 3.5 9 8l-5.5 4.5ZM12 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>Show answer</span>
      </button>
    </div>
    </div>
  );
}
