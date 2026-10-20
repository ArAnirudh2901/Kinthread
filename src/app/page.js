import Link from 'next/link';
import Hero from '@/components/home/Hero';
import Workbench from '@/components/workbench/Workbench';
import s from './page.module.css';

const DEEPER = [
  { href: '/how-it-works/', title: 'How it works', text: 'From a story to people, to a path, to an answer: two small models running in this tab.' },
  { href: '/limits/', title: 'Limits & tips', text: 'What the model handles well, where it struggles, and how to write stories it reads best.' },
  { href: '/build-log/', title: 'Build log', text: 'How both models were designed, trained from scratch, evaluated and shipped to the browser.' },
];

export default function Home() {
  return (
    <main id="main">
      <Hero />
      <Workbench />
      <section className={`container ${s.deeper}`} aria-labelledby="deeper-title">
        <h2 id="deeper-title" className={s.deeperTitle}>Go deeper</h2>
        <ul>
          {DEEPER.map((d) => (
            <li key={d.href}>
              <Link href={d.href} className={s.row}>
                <span className={`display ${s.title}`}>{d.title}</span>
                <span className={s.text}>{d.text}</span>
                <svg className={s.arrow} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
