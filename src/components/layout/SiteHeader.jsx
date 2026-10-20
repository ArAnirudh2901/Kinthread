'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Mark from '@/components/brand/Mark';
import { liquidBar } from '@/lib/liquid';
import ModelStatus from './ModelStatus';
import ThemeToggle from './ThemeToggle';
import s from './SiteHeader.module.css';

const NAV = [
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/limits/', label: 'Limits & tips' },
  { href: '/build-log/', label: 'Build log' },
];

export default function SiteHeader() {
  const path = usePathname();
  const here = (href) => path === href || path === href.slice(0, -1);
  // one underline for the whole nav: it rests under the current page and slides (stretching) to whatever is pointed at
  const list = useRef(null), bar = useRef(null), liquid = useRef(null);
  const current = () => list.current?.querySelector('a[aria-current="page"]') || null;
  useEffect(() => {
    liquid.current ??= liquidBar(list.current, bar.current);
    liquid.current.to(current(), { instant: !bar.current.dataset.ready });
    bar.current.dataset.ready = '1';
    const onResize = () => liquid.current.to(current(), { instant: true });
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [path]);
  const point = (e) => liquid.current?.to(e.currentTarget);
  const rest = () => liquid.current?.to(current());
  return (
    <header className={s.header}>
      <div className={`container ${s.inner}`}>
        <Link href="/" className={s.brand} aria-label="Kinthread, home">
          <Mark size={30} className={s.mark} />
          <span className={s.word} translate="no">Kinthread</span>
        </Link>
        <nav className={s.nav} aria-label="Primary">
          <ul ref={list} onPointerLeave={rest}>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={here(n.href) ? 'page' : undefined} onPointerEnter={point} onFocus={point} onBlur={rest}>{n.label}</Link>
              </li>
            ))}
            <li ref={bar} className={s.bar} aria-hidden="true" />
          </ul>
        </nav>
        <div className={s.tools}>
          <ModelStatus />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
