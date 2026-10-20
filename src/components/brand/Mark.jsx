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
      {/* one look in both themes: the dark board tile with chalk colours (the favicon's), never theme tokens */}
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#11201A" stroke="#EDF2EA" strokeOpacity="0.14" />
      <g transform="translate(3.2 3.2) scale(0.8)">
        <g fill="none" strokeWidth="1.9" strokeLinecap="round">
          <path data-thread="" pathLength="1" style={{ '--i': 0 }} stroke="#EDF2EA" d="M11 4.6C10.1 11.2 11.9 19.4 11 27.4" />
          <path data-thread="" pathLength="1" style={{ '--i': 1 }} stroke="#F3D34A" strokeWidth="2.3" d="M11.3 15.3C15.6 13.9 19 10.2 23.4 6.2" />
          <path data-thread="" pathLength="1" style={{ '--i': 2 }} stroke="#EDF2EA" d="M11.3 15.3C16 16.9 19.7 21.3 23.8 26.2" />
        </g>
        {/* the map's own parts: facts (square, circle), the question's diamond, the answer on its thread */}
        <g stroke="#11201A" strokeWidth="1.3">
          <rect x="8.6" y="2.2" width="4.8" height="4.8" rx="1" fill="#8FC8F2" />
          <circle cx="11" cy="27.4" r="2.5" fill="#8FC8F2" />
          <circle cx="23.4" cy="6.2" r="3.1" fill="#F3D34A" />
          <path d="M23.8 22.6 27.4 26.2 23.8 29.8 20.2 26.2Z" fill="#11201A" stroke="#E4EBE2" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="11.3" cy="15.3" r="1.5" fill="#EDF2EA" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
