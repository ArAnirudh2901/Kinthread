// Shared motion: a closed-form spring step response turned into a CSS `linear()` easing, so WAAPI and CSS animations
// get spring motion without a library. Damping 0.82 overshoots about 1%: alive, never bouncy.
const supportsLinear = typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
const cache = new Map();

/** Easing for an animation of `ms` milliseconds that settles exactly at its end. */
export function springEasing(ms = 700, zeta = 0.82) {
  const key = `${ms}|${zeta}`;
  if (cache.has(key)) return cache.get(key);
  let value = 'cubic-bezier(0.22, 1, 0.36, 1)';
  if (supportsLinear) {
    const T = ms / 1000, w = 6.2 / (zeta * T), wd = w * Math.sqrt(1 - zeta * zeta);   // settles to 0.2% by T
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * T;
      const x = i === 40 ? 1 : 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
      pts.push(+x.toFixed(4));
    }
    value = `linear(${pts.join(', ')})`;
  }
  cache.set(key, value);
  return value;
}

export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
