'use client';
import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import s from './PipelineDiagram.module.css';

// Story -> people -> path -> answer. Each stage rises in (3D tilt to flat) once it scrolls into view;
// an IntersectionObserver starts the timeline, so no scroll listener runs.
const STAGES = [
  { n: '01', title: 'Find the people', model: '5.1M-parameter name model', text: 'Reads the story and marks every word that is a person’s name. Places and companies are left out.' },
  { n: '02', title: 'Trace the path', model: '13.0M-parameter transformer, 6 layers', text: 'Writes the chain of family facts that leads from the first person to the second, one checked step at a time.' },
  { n: '03', title: 'Name the relation', model: 'Same transformer', text: 'Reads its own chain and names the relationship, or says the story doesn’t establish one.' },
];

function Visual({ i }) {
  if (i === 0) {
    return (
      <p className={s.story}>
        <mark>Ashley</mark>&rsquo;s daughter, <mark>Lillian</mark>, asked her mom to read her a story. <mark>Nicholas</mark>&rsquo;s sister <mark>Lillian</mark> asked him for some help.
      </p>
    );
  }
  if (i === 1) {
    return (
      <ol className={s.tokens} aria-label="Chain written by the model">
        {['@0', 'daughter', '@1', '<sep>', '@1', 'brother', '@2', '<sep>'].map((t, k) => (
          <li key={k} className={t.startsWith('@') ? s.ent : t.startsWith('<') ? s.sp : undefined}>{t}</li>
        ))}
      </ol>
    );
  }
  return (
    <svg viewBox="0 0 220 70" className={s.mini} role="img" aria-label="Ashley, daughter, Lillian, brother, Nicholas: Nicholas is Ashley's son">
      <path d="M20 44C50 14 80 14 110 44C140 14 170 14 200 44" className={s.band} />
      <path d="M20 44C50 14 80 14 110 44" className={s.thread} data-draw="" />
      <path d="M110 44C140 14 170 14 200 44" className={s.thread} data-draw="" />
      <circle cx="20" cy="44" r="7" className={s.a} />
      <circle cx="110" cy="44" r="5" className={s.via} />
      <circle cx="200" cy="44" r="7" className={s.b} />
      <text x="200" y="66" textAnchor="middle" className={s.ans}>son</text>
    </svg>
  );
}

export default function PipelineDiagram() {
  const root = useRef(null);
  useGSAP(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ paused: true });
    tl.from(q('li'), { autoAlpha: 0, y: 24, rotationX: -14, transformPerspective: 900, transformOrigin: '50% 0%', duration: 0.7, ease: 'expo.out', stagger: 0.12, clearProps: 'transform' })
      .from(q('[data-draw]'), { drawSVG: '0%', duration: 0.5, ease: 'power2.inOut', stagger: 0.25 }, 0.45);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { tl.play(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(root.current);
    return () => io.disconnect();
  }, { scope: root });

  return (
    <ol ref={root} className={s.pipeline}>
      {STAGES.map((st, i) => (
        <li key={st.n} className={s.stage}>
          <p className={s.n}>{st.n}</p>
          <h3 className={s.title}>{st.title}</h3>
          <div className={s.visual}><Visual i={i} /></div>
          <p className={s.model}>{st.model}</p>
          <p className={s.text}>{st.text}</p>
        </li>
      ))}
    </ol>
  );
}
