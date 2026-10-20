'use client';
import { useSyncExternalStore } from 'react';
import { modelStore } from './client';

export function useModel() {
  return useSyncExternalStore(modelStore.subscribe, modelStore.get, modelStore.server);
}
