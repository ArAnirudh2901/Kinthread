'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShapeMorph } from '@/lib/useShapeMorph';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import s from './TraceBar.module.css';

export default function TraceBar({ reason, note, running, canTrace, onTrace }) {
  const root = useRef(null);
  const btn = useRef(null);
  const runTl = useRef(null);
  const hovered = useRef(false);
  // a quick solve keeps the pill; a slow one (first run, a long story) turns it into a loader circle
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setSlow(true), 150);
    return () => { clearTimeout(t); setSlow(false); };
  }, [running]);
  useShapeMorph(btn, slow ? 'slow' : 'idle');
  const guide = useRef(null);
  useShapeMorph(guide, reason || note || '');   // the guidance line resizes and its words blur in

  // Solve button: leans toward the pointer (quickTo reuses one tween per axis), and a light runs along
  // the thread inside it on hover and while solving.
  const { contextSafe } = useGSAP(() => {
    const el = btn.current;
    runTl.current = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.15 })
      .fromTo('[data-runner]', { drawSVG: '0% 0%' }, { drawSVG: '0% 35%', duration: 0.22, ease: 'power1.in' })
      .to('[data-runner]', { drawSVG: '65% 100%', duration: 0.5, ease: 'none' })
      .to('[data-runner]', { drawSVG: '100% 100%', duration: 0.22, ease: 'power1.out' });

    if (prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    const move = (e) => {
      if (el.disabled) return;
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.18);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    };
    const leave = () => { xTo(0); yTo(0); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, { scope: root });

  const runner = useCallback((on) => {
    const tl = runTl.current;
    if (!tl || prefersReducedMotion()) return;
    if (on) tl.play();
    else { tl.pause(); tl.progress(0); }
  }, []);
  useEffect(() => { runner(running || hovered.current); }, [running, runner]);

  const hover = useCallback((on) => {
    hovered.current = on;
    runner((on && !btn.current?.disabled) || running);
  }, [runner, running]);

  // sinks on press, springs back on release
  const press = contextSafe((el, down) => {
    if (el.disabled || prefersReducedMotion()) return;
    gsap.to(el, { scale: down ? 0.96 : 1, duration: down ? 0.12 : 0.5, ease: down ? 'power2.out' : 'elastic.out(1, 0.45)', overwrite: 'auto' });
  });

  return (
    <div className={s.bar} ref={root}>
      <div className={s.actions}>
        <button
          ref={btn}
          type="button"
          data-solve=""
          className={`${s.trace} morph`}
          data-running={running || undefined}
          data-slow={slow || undefined}
          onClick={onTrace}
          onPointerEnter={() => hover(true)}
          onPointerLeave={(e) => { hover(false); press(e.currentTarget, false); }}
          onPointerDown={(e) => press(e.currentTarget, true)}
          onPointerUp={(e) => press(e.currentTarget, false)}
          disabled={!canTrace}
          aria-describedby={reason || note ? 'trace-reason' : undefined}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={s.glyph}>
            <path d="M3 16c3-8 6-8 9 0s6 8 9 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={s.wave} />
            <path d="M3 16c3-8 6-8 9 0s6 8 9 0" fill="none" strokeWidth="2.6" strokeLinecap="round" className={s.runner} data-runner="" />
            <circle cx="3" cy="16" r="2.2" className={s.dotA} />
            <circle cx="21" cy="16" r="2.2" className={s.dotB} />
          </svg>
          {!slow && <span>{running ? 'Solving\u2026' : 'Solve'}</span>}
        </button>
      </div>
      <div ref={guide} className={s.guide}>{(reason || note) && <p id="trace-reason" className={s.reason}>{reason || note}</p>}</div>
    </div>
  );
}
