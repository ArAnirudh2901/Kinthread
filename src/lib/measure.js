// Exact text widths for SVG labels via one shared canvas (microseconds per call, cached).
// Falls back to an estimate where there is no canvas (server render, very old browsers).
let ctx;
const cache = new Map();
const fonts = {};

function family(kind) {
  if (!fonts[kind]) {
    const root = getComputedStyle(document.documentElement);
    fonts[kind] = (kind === 'mono' ? root.getPropertyValue('--font-mono') : getComputedStyle(document.body).fontFamily).trim() || 'sans-serif';
  }
  return fonts[kind];
}

/** kind: 'name' (500 14px UI font) | 'tag' (500 11.5px mono) | 'role' (500 10px mono, uppercase, 0.1em tracking) */
export function textWidth(text, kind) {
  const key = `${kind}\u0000${text}`;
  const hit = cache.get(key);
  if (hit != null) return hit;
  let w;
  if (typeof document === 'undefined' || !(ctx ??= document.createElement('canvas').getContext('2d'))) {
    w = text.length * (kind === 'name' ? 7.6 : kind === 'tag' ? 7 : 7.2);
  } else {
    ctx.font = kind === 'name' ? `500 14px ${family('ui')}` : kind === 'tag' ? `500 11.5px ${family('mono')}` : `500 10px ${family('mono')}`;
    const t = kind === 'role' ? text.toUpperCase() : text;
    w = ctx.measureText(t).width + (kind === 'role' ? t.length * 1 : kind === 'tag' ? t.length * 0.23 : 0);
  }
  cache.set(key, w);
  return w;
}

/** Shorten text with an ellipsis until it fits maxWidth. */
export function fitText(text, kind, maxWidth) {
  if (textWidth(text, kind) <= maxWidth) return text;
  let lo = 1, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (textWidth(`${text.slice(0, mid)}…`, kind) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

/** Widths change once web fonts finish loading. */
export function resetMeasurements() {
  cache.clear();
  for (const k of Object.keys(fonts)) delete fonts[k];
}
