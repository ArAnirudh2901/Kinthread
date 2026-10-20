export const mb = (bytes) => (bytes / 1e6).toFixed(1);

/** "61.4 MB" with a non-breaking space */
export const mbText = (bytes) => `${mb(bytes)}\u00a0MB`;

export const ms = (x) => (x == null || !Number.isFinite(x) ? '—' : x < 10 ? `${x.toFixed(1)} ms` : `${Math.round(x)} ms`);

export const score = (x) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(2));

export const ENGINE_NAMES = {
  'relaxed-mt': 'Relaxed SIMD, multi-threaded',
  'simd-mt': 'SIMD, multi-threaded',
  'scalar-mt': 'Scalar, multi-threaded',
  relaxed: 'Relaxed SIMD',
  simd: 'SIMD',
  scalar: 'Scalar',
};

export const engineName = (info) => {
  if (!info) return '—';
  const name = ENGINE_NAMES[info.engine] || info.engine;
  return info.threads > 1 ? `${name} · ${info.threads} threads` : name;
};

export const millions = (n) => `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
