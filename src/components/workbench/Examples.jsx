'use client';
import { EXAMPLES } from '@/lib/examples';
import s from './Examples.module.css';

export default function Examples({ onPick }) {
  return (
    <div className={s.examples}>
      <p className={s.label} id="examples-label">No story handy? Try one:</p>
      <ul className={s.list} aria-labelledby="examples-label">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button type="button" className={s.example} onClick={(e) => onPick(ex, e.currentTarget)} aria-describedby={`ex-${ex.id}`} title={ex.hint}>
              {ex.label}
              <svg className={s.arrow} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="visually-hidden" id={`ex-${ex.id}`}>{ex.hint}. Loads the story and solves it.</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
