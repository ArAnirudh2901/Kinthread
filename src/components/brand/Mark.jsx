import s from './Mark.module.css';

// Kinthread mark: a stem thread with two branches from one junction (reads as a K), four person nodes.
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
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path pathLength="1" style={{ '--i': 0 }} d="M11 4.6C10.1 11.2 11.9 19.4 11 27.4" />
        <path pathLength="1" style={{ '--i': 1 }} d="M11.3 15.3C15.6 13.9 19 10.2 23.4 6.2" />
        <path pathLength="1" style={{ '--i': 2 }} d="M11.3 15.3C16 16.9 19.7 21.3 23.8 26.2" />
      </g>
      <g stroke="currentColor" strokeWidth="1.4">
        <circle cx="11" cy="4.6" r="2.5" fill="var(--sea)" />
        <circle cx="11" cy="27.4" r="2.5" fill="var(--sea)" />
        <circle cx="23.4" cy="6.2" r="2.9" fill="var(--lichen)" />
        <circle cx="23.8" cy="26.2" r="2.5" fill="var(--copper)" />
        <circle cx="11.3" cy="15.3" r="1.5" fill="currentColor" />
      </g>
    </svg>
  );
}
