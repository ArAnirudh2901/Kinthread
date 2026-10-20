'use client';
import { useLayoutEffect, useRef } from 'react';
import { EASE_OUT, reducedMotion, springEasing } from './motion';

// One shape, never cut: when `key` changes, the element springs from the size it had to its new one (colour and
// radius follow by CSS transition) and its new content blurs in. Interrupting starts from wherever it is.
export function useShapeMorph(ref, key, { ms = 460 } = {}) {
  const last = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const prev = last.current;
    last.current = { key, w: r.width, h: r.height };
    if (!prev || prev.key === key || !prev.w || reducedMotion()) return;
    if (Math.abs(prev.w - r.width) > 0.5 || Math.abs(prev.h - r.height) > 0.5) {
      el.animate({ width: [`${prev.w}px`, `${r.width}px`], height: [`${prev.h}px`, `${r.height}px`] }, { duration: ms, easing: springEasing(ms) });
    }
    for (const c of el.children) c.animate?.({ opacity: [0, 1], filter: ['blur(4px)', 'blur(0px)'] }, { duration: 240, easing: EASE_OUT });
  });
}
