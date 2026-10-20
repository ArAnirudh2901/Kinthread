'use client';
import { useEffect } from 'react';
import { startSmoothScroll } from '@/lib/smooth-scroll';

// Offline shell: production only, so development never serves stale files.
export default function Providers({ children }) {
  useEffect(() => startSmoothScroll(), []);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return children;
}
