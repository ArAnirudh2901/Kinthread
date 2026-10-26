'use client';
import { useEffect } from 'react';
import { startSmoothScroll } from '@/lib/smooth-scroll';
import { checkReleaseOnPageLoad } from '@/lib/model/client';
import ModelUpdateNotice from '@/components/workbench/ModelUpdateNotice';

// Offline shell: production only, so development never serves stale files.
export default function Providers({ children }) {
  useEffect(() => startSmoothScroll(), []);
  useEffect(() => { void checkReleaseOnPageLoad(); }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return <>
    <ModelUpdateNotice />
    {children}
  </>;
}
