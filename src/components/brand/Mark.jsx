import s from './Mark.module.css';

// Kinthread mark: a stem thread with two branches from one junction (reads as a K), drawn in the map's own language.
// animate: 'none' | 'draw' (once) | 'loop' (quiet repeating draw while something loads). CSS only.
export default function Mark({ size = 28, animate = 'none', title, className }) {
  return (
    <svg
      className={`${s.mark} ${className || ''}`}
      data-animate={animate === 'none' ? undefined : animate}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <g fill="none" strokeWidth="1.9" strokeLinecap="round">
        <path data-thread="" pathLength="1" style={{ '--i': 0 }} stroke="currentColor" d="M11 4.6C10.1 11.2 11.9 19.4 11 27.4" />
        <path data-thread="" pathLength="1" style={{ '--i': 1 }} stroke="var(--answer)" strokeWidth="2.3" d="M11.3 15.3C15.6 13.9 19 10.2 23.4 6.2" />
        <path data-thread="" pathLength="1" style={{ '--i': 2 }} stroke="currentColor" d="M11.3 15.3C16 16.9 19.7 21.3 23.8 26.2" />
      </g>
      {/* the map's own parts: facts (square, circle), the question's diamond, the answer on its thread */}
      <g stroke="var(--node-stroke)" strokeWidth="1.3">
        <rect x="8.6" y="2.2" width="4.8" height="4.8" rx="1" fill="var(--fact)" />
        <circle cx="11" cy="27.4" r="2.5" fill="var(--fact)" />
        <circle cx="23.4" cy="6.2" r="3.1" fill="var(--answer)" />
        <path d="M23.8 22.6 27.4 26.2 23.8 29.8 20.2 26.2Z" fill="var(--bg)" stroke="var(--question)" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="11.3" cy="15.3" r="1.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
