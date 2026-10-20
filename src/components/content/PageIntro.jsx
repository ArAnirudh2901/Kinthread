import s from './content.module.css';

export default function PageIntro({ eyebrow, title, children }) {
  return (
    <header className={`container ${s.intro}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className={`display ${s.title}`}>{title}</h1>
      <div className={s.lede}>{children}</div>
    </header>
  );
}
