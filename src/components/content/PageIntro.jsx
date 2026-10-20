import s from './content.module.css';

export default function PageIntro({ meta, title, children }) {
  return (
    <header className={`container ${s.intro}`}>
      <h1 className={`display ${s.title}`}>{title}</h1>
      <div className={s.lede}>{children}</div>
      {meta && <p className="label">{meta}</p>}
    </header>
  );
}
