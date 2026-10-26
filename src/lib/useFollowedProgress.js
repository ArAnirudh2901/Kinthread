'use client';
import { useEffect, useMemo, useState } from 'react';
import { createFollower } from './progress-follow';

/** The loader's displayed progress (0-1) for a raw download fraction: see progress-follow.js for the guarantees. */
export function useFollowedProgress(raw, resetKey = 0) {
  const follower = useMemo(() => createFollower(), [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reset the follower when a new download starts
  const [progress, setProgress] = useState({ key: resetKey, shown: 0 });
  useEffect(() => {
    follower.push(raw);
    let id = 0;
    const tick = (now) => {
      setProgress({ key: resetKey, shown: follower.step(now / 1000) });
      if (follower.moving) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [follower, raw, resetKey]);
  return progress.key === resetKey ? progress.shown : 0;
}
