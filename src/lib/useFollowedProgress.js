'use client';
import { useEffect, useState } from 'react';
import { createFollower } from './progress-follow';

/** The loader's displayed progress (0-1) for a raw download fraction: see progress-follow.js for the guarantees. */
export function useFollowedProgress(raw) {
  const [follower] = useState(createFollower);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    follower.push(raw);
    let id = 0;
    const tick = (now) => {
      setShown(follower.step(now / 1000));
      if (follower.moving) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [follower, raw]);
  return shown;
}
