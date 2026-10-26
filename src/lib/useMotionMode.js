'use client';
import { useSyncExternalStore } from 'react';
import { deviceProfile } from './model/device-profile';

// 'none' when the user asks for reduced motion; 'lite' on low-end or data-saving devices; else 'full'.
const query = () => matchMedia('(prefers-reduced-motion: reduce)');

function subscribe(cb) {
  const mq = query();
  mq.addEventListener?.('change', cb);
  return () => mq.removeEventListener?.('change', cb);
}

function getMode() {
  if (query().matches) return 'none';
  return deviceProfile().tier === 'low' ? 'lite' : 'full';
}

export function useMotionMode() {
  return useSyncExternalStore(subscribe, getMode, () => 'full');
}
