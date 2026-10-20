'use client';
import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import s from './ThemeToggle.module.css';

const KEY = 'kinthread-theme';
// html[data-theme="light"] or nothing (dark, the default); set before paint by the script in layout.js
const subscribe = (cb) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
};
const getTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);

  const toggle = (e) => {
    const root = document.documentElement;
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    const apply = () => {
      if (next === 'light') root.dataset.theme = 'light';
      else delete root.dataset.theme;
      try { localStorage.setItem(KEY, next); } catch { /* switches for this visit only */ }
      // status bar / browser chrome follows the page, not the OS
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    };
    if (prefersReducedMotion()) return apply();
    if (!document.startViewTransition) {
      // older browsers: every colour cross-fades instead
      root.classList.add('theme-fade');
      apply();
      setTimeout(() => root.classList.remove('theme-fade'), 600);
      return;
    }
    // the new theme grows out of the toggle as a circle, on the compositor
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      className={s.toggle}
      onClick={toggle}
      aria-label={theme ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` : 'Switch color theme'}
    >
      {/* the icon follows html[data-theme] in CSS, so server and client render the same markup */}
      <svg className={s.sun} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <svg className={s.moon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
