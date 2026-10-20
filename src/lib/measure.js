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

/** kind: 'name' (500 14px UI font) | 'tag' (500 11.5px mono) | 'role' (500 12px UI font) */
export function textWidth(text, kind) {
  const key = `${kind}\u0000${text}`;
  const hit = cache.get(key);
  if (hit != null) return hit;
  let w;
  if (typeof document === 'undefined' || !(ctx ??= document.createElement('canvas').getContext('2d'))) {
    w = text.length * (kind === 'name' ? 7.6 : kind === 'tag' ? 7 : 6.6);
  } else {
    ctx.font = kind === 'tag' ? `500 11.5px ${family('mono')}` : `500 ${kind === 'name' ? 14 : 12}px ${family('ui')}`;
    w = ctx.measureText(text).width + (kind === 'tag' ? text.length * 0.23 : 0);
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
