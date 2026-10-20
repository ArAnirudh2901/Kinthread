'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Mark from '@/components/brand/Mark';
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
  return (
    <header className={s.header}>
      <div className={`container ${s.inner}`}>
        <Link href="/" className={s.brand} aria-label="Kinthread, home">
          <Mark size={30} className={s.mark} />
          <span className={s.word} translate="no">Kinthread</span>
        </Link>
        <nav className={s.nav} aria-label="Primary">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={here(n.href) ? 'page' : undefined}>{n.label}</Link>
              </li>
            ))}
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
