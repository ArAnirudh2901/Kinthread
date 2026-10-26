// Keep inference and decoration within a device's available CPU, memory and network budget.
export function deviceProfile(n = globalThis.navigator) {
  const cores = Math.max(1, Number(n?.hardwareConcurrency) || 1);
  const memory = Number(n?.deviceMemory) || 0;
  const connection = n?.connection;
  const constrainedNetwork = connection?.saveData === true || ['slow-2g', '2g'].includes(connection?.effectiveType);
  const low = cores <= 2 || (memory > 0 && memory <= 2) || constrainedNetwork;
  if (low) return { tier: 'low', engine: 'single', maxThreads: 1, maxDownloads: 1 };
  if (cores <= 4 || (memory > 0 && memory <= 4)) {
    return { tier: 'balanced', engine: 'auto', maxThreads: 2, maxDownloads: 2 };
  }
  return { tier: 'high', engine: 'auto', maxThreads: 4, maxDownloads: 3 };
}
