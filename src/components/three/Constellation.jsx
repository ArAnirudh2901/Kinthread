'use client';
import { useEffect, useRef } from 'react';
import { useMotionMode } from '@/lib/useMotionMode';

// Decorative 3D canvas. The WebGL code is a separate chunk loaded after the page is interactive.
export default function Constellation({ variant = 'hero', progress = 1, className }) {
  const ref = useRef(null);
  const ctl = useRef(null);
  const latest = useRef(progress);
  const mode = useMotionMode();

  useEffect(() => {
    let alive = true;
    import('@/lib/gl/constellation').then(({ createConstellation }) => {
      if (!alive || !ref.current) return;
      ctl.current = createConstellation(ref.current, { variant, lite: mode === 'lite', still: mode === 'none' });
      ctl.current?.setProgress(latest.current);
    });
    return () => { alive = false; ctl.current?.destroy(); ctl.current = null; };
  }, [variant, mode]);

  useEffect(() => { latest.current = progress; ctl.current?.setProgress(progress); }, [progress]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
