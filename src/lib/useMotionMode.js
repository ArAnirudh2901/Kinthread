'use client';
import { useSyncExternalStore } from 'react';

// 'none' when the user asks for reduced motion; 'lite' on low-end or data-saving devices; else 'full'.
const query = () => matchMedia('(prefers-reduced-motion: reduce)');

function subscribe(cb) {
  const mq = query();
  mq.addEventListener?.('change', cb);
  return () => mq.removeEventListener?.('change', cb);
}

function getMode() {
  if (query().matches) return 'none';
  const n = navigator;
  const low = (n.hardwareConcurrency || 8) <= 2 || (n.deviceMemory || 8) <= 2 || n.connection?.saveData === true;
  return low ? 'lite' : 'full';
}

export function useMotionMode() {
  return useSyncExternalStore(subscribe, getMode, () => 'full');
}
