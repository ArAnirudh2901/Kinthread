'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { EASE_OUT, reducedMotion } from '@/lib/motion';
import s from './MorphText.module.css';

const STAGGER = { chars: 45, words: 35 };

const pieces = (node, split) => typeof node !== 'string' || split === 'none' ? node
  : (split === 'chars' ? [...node] : node.split(/(\s+)/))
    .map((p, i) => (/^\s+$/.test(p) ? p : <span key={i} className={s.piece}>{p}</span>));

/**
 * Text that never swaps: when `id` changes, the old text blurs up and out while the new one settles in piece by piece
 * (both stacked in one grid cell, so nothing reflows). Same `id`, new children (a live byte count): updated in place.
 */
export default function MorphText({ id, children, as: Tag = 'span', split = 'words', className, ...rest }) {
  const [st, setSt] = useState({ id, node: children, leaving: null, gen: 0 });
  if (st.id !== id) setSt({ id, node: children, leaving: { id: st.id, node: st.node }, gen: st.gen + 1 });
  const out = useRef(null), inn = useRef(null);

  useLayoutEffect(() => {
    if (!st.gen) return;
    const reduce = reducedMotion(), anims = [];
    if (out.current) {
      anims.push(out.current.animate(reduce ? { opacity: [1, 0] }
        : { opacity: [1, 0], filter: ['blur(0px)', 'blur(6px)'], transform: ['none', 'translateY(-0.2em)'] },
      { duration: reduce ? 200 : 280, easing: EASE_OUT, fill: 'forwards' }));
    }
    const parts = inn.current ? [...inn.current.querySelectorAll(`.${s.piece}`)] : [];
    (reduce || !parts.length ? [inn.current] : parts).forEach((el, i) => el && anims.push(el.animate(reduce ? { opacity: [0, 1] }
      : { opacity: [0, 1], filter: ['blur(6px)', 'blur(0px)'], transform: ['translateY(0.25em)', 'none'] },
    { duration: reduce ? 200 : 460, delay: reduce ? 0 : 90 + i * (STAGGER[split] || 0), easing: EASE_OUT, fill: 'backwards' })));
    const gen = st.gen;
    Promise.all(anims.map((a) => a.finished)).catch(() => {})
      .then(() => setSt((cur) => (cur.gen === gen ? { ...cur, leaving: null } : cur)));
  }, [st.gen]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = st.id === id ? children : st.node;
  return (
    <Tag className={`${s.morph} ${className || ''}`} {...rest}>
      {st.leaving && <span key={`out-${st.gen}`} ref={out} className={s.layer} data-id={st.leaving.id} aria-hidden="true">{st.leaving.node}</span>}
      <span key={`in-${st.gen}`} ref={inn} className={s.layer} data-id={id}>{st.gen ? pieces(current, split) : current}</span>
    </Tag>
  );
}
