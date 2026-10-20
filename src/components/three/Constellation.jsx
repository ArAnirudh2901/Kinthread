'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMotionMode } from '@/lib/useMotionMode';

// Decorative 3D canvas. The WebGL code is a separate chunk loaded after the page is interactive.
export default function Constellation({ variant = 'hero', progress = 1, className, onWoven }) {
  const ref = useRef(null);
  const ctl = useRef(null);
  const latest = useRef(progress);
  const mode = useMotionMode();
  const woven = useRef(onWoven);
  useEffect(() => { woven.current = onWoven; }, [onWoven]);

  useEffect(() => {
    let alive = true;
    import('@/lib/gl/constellation').then(({ createConstellation }) => {
      if (!alive || !ref.current) return;
      ctl.current = createConstellation(ref.current, { variant, lite: mode === 'lite', still: mode === 'none', onWoven: () => woven.current?.() });
      ctl.current?.setProgress(latest.current);
    });
    return () => { alive = false; ctl.current?.destroy(); ctl.current = null; };
  }, [variant, mode]);

  // before paint, so the weave and the percentage beside it change in the same frame
  useLayoutEffect(() => { latest.current = progress; ctl.current?.setProgress(progress); }, [progress]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
