// Layout for a worked answer, drawn like a family tree on paper: one row per generation (parents above,
// children below), people left to right in the order the reasoning visits them, one arrow per fact,
// and the answer arrow from A to B bowing away from everyone else.
// A's name sits to its left and B's to its right (that space is always free), the others above or below,
// whichever side no arrow uses. Pure; overlap-tested in tests/solution.test.mjs.
import { generations } from './relations.js';

export const ROW = 128;          // distance between generations
export const R = 13;             // radius of a person's shape
export const TAG_H = 24;
const MARGIN = 14;
const NAME_H = 30;               // name + role caption

const r1 = (v) => Math.round(v * 10) / 10;
const quad = (p, c, q, t) => ({
  x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * c.x + t * t * q.x,
  y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * c.y + t * t * q.y,
});

/** Curved arrow between two people (centres p, q), its apex `bend` px to the left of travel. */
function arrow(p, q, bend) {
  const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const c = { x: (p.x + q.x) / 2 + nx * bend * 2, y: (p.y + q.y) / 2 + ny * bend * 2 };   // quadratic apex = half the control offset
  const trim = (from, r) => {
    const tx = c.x - from.x, ty = c.y - from.y, tl = Math.hypot(tx, ty) || 1;
    return { x: from.x + (tx / tl) * r, y: from.y + (ty / tl) * r };
  };
  const s = trim(p, R + 4), e = trim(q, R + 5);
  const hx = e.x - c.x, hy = e.y - c.y, hl = Math.hypot(hx, hy) || 1;
  const ux = hx / hl, uy = hy / hl;
  return {
    d: `M${r1(s.x)} ${r1(s.y)}Q${r1(c.x)} ${r1(c.y)} ${r1(e.x)} ${r1(e.y)}`,
    head: `M${r1(e.x + ux * 2)} ${r1(e.y + uy * 2)}L${r1(e.x - ux * 9 - uy * 5.5)} ${r1(e.y - uy * 9 + ux * 5.5)}L${r1(e.x - ux * 9 + uy * 5.5)} ${r1(e.y - uy * 9 - ux * 5.5)}Z`,
    mid: quad(s, c, e, 0.5),
  };
}

const box = (cx, cy, w, h) => ({ x: r1(cx - w / 2), y: r1(cy - h / 2), w, h, cx: r1(cx), cy: r1(cy) });

/**
 * @param {number} boxWidth  visible width (the caller scales or scrolls if the layout is wider)
 * @param {string[]} words   relation word of each fact, in order
 * @param {number[]} nameW   label width of each person (px; endpoints include their role caption)
 * @param {number[]} tagW    tag width of each fact (px, including its step number)
 * @param {number} answerW   tag width of the answer
 */
export function solutionLayout(boxWidth, words, nameW, tagW, answerW, extraPad = 0) {
  const gens = generations(words);
  const n = gens.length;
  const maxG = Math.max(...gens), minG = Math.min(...gens);

  // where each name goes: away from its arrows. On wide screens A's name sits to its left and B's to its
  // right; on phones (compact) every name goes above or below, so the diagram fits without scrolling.
  const compact = boxWidth < 520;
  const labelSide = gens.map((g, i) => {
    if (i === 0 && !compact) return 'left';
    if (i === n - 1 && !compact) return 'right';
    let up = 0, down = 0;
    for (const j of [i - 1, i + 1]) { if (gens[j] > g) up++; if (gens[j] < g) down++; }
    return down > up ? 'above' : 'below';
  });

  // spacing per step: a tag on a flat arrow sits between two people and needs its width; a tag on a
  // diagonal arrow sits between rows and needs much less. Gaps then grow only where something collides.
  const gaps = words.map((_, i) => (gens[i] === gens[i + 1] ? tagW[i] + 30 : Math.max(64, tagW[i] / 2 + 34)));
  for (let i = 0; i < n - 1; i++) {
    const ni = labelSide[i] === 'left' ? 0 : nameW[i] / 2, nj = labelSide[i + 1] === 'right' ? 0 : nameW[i + 1] / 2;
    if (gens[i] === gens[i + 1] && labelSide[i] === labelSide[i + 1]) gaps[i] = Math.max(gaps[i], ni + nj + 20);
  }
  const edge = compact ? 4 : MARGIN;   // phones: every pixel of width counts
  const edgePad = (i) => (labelSide[i] === 'left' || labelSide[i] === 'right' ? edge + nameW[i] + R + 10 : edge + Math.max(nameW[i] / 2, R) + 4);
  // the answer tag usually sits mid-arc; if it would leave the frame, the search below adds room
  const padL = edgePad(0) + extraPad;
  const padR = edgePad(n - 1) + extraPad;
  const top = 64;

  const labelAt = (p, i) => {
    const ls = labelSide[i];
    if (ls === 'left') return { x: p.x - R - 10, y: p.y - 2, anchor: 'end', box: { x: p.x - R - 10 - nameW[i], y: p.y - 14, w: nameW[i], h: NAME_H } };
    if (ls === 'right') return { x: p.x + R + 10, y: p.y - 2, anchor: 'start', box: { x: p.x + R + 10, y: p.y - 14, w: nameW[i], h: NAME_H } };
    const y = ls === 'above' ? p.y - R - 14 : p.y + R + 26;   // below: clear of a tag sitting on a flat arrow
    return { x: p.x, y, anchor: 'middle', box: { x: p.x - nameW[i] / 2, y: y - 12, w: nameW[i], h: 16 } };
  };
  const hit = (u, v, pad = 4) => u.x < v.x + v.w + pad && v.x < u.x + u.w + pad && u.y < v.y + v.h + pad && v.y < u.y + u.h + pad;

  let pts, facts, labels, natural;
  for (let round = 0; round < 60; round++) {
    natural = Math.ceil(padL + padR + gaps.reduce((x, y) => x + y, 0));
    const stretch = n > 1 ? Math.max(0, boxWidth - natural) / (n - 1) : 0;
    let x = n === 1 ? Math.max(boxWidth, natural) / 2 : padL;
    pts = gens.map((g, i) => {
      if (i > 0) x += gaps[i - 1] + stretch;
      return { x: r1(x), y: top + (maxG - g) * ROW, gen: g };
    });
    facts = words.map((_, i) => {
      const a = arrow(pts[i], pts[i + 1], (i % 2 ? -1 : 1) * 8);
      return { d: a.d, head: a.head, tag: box(a.mid.x, a.mid.y, tagW[i], TAG_H) };
    });
    labels = pts.map(labelAt);
    // find a collision and widen the step(s) around it
    const items = [
      ...labels.map((l, i) => ({ b: l.box, lo: Math.max(0, i - 1), hi: Math.min(n - 2, i) })),
      ...facts.map((f, i) => ({ b: f.tag, lo: i, hi: i })),
      ...pts.map((p, i) => ({ b: { x: p.x - R, y: p.y - R, w: 2 * R, h: 2 * R }, lo: Math.max(0, i - 1), hi: Math.min(n - 2, i), person: i })),
    ];
    let grew = false;
    for (let u = 0; u < items.length && !grew; u++) {
      for (let v = u + 1; v < items.length; v++) {
        if (items[u].person != null && items[v].person != null) continue;
        if (hit(items[u].b, items[v].b)) {
          const lo = Math.min(items[u].lo, items[v].lo), hi = Math.max(items[u].hi, items[v].hi);
          for (let k = lo; k <= hi; k++) gaps[k] += 12;
          grew = true;
          break;
        }
      }
    }
    if (!grew) break;
  }
  const width = Math.max(boxWidth, natural);

  // answer bows away from the people in between; with nobody in between, above (names sit below)
  const A = pts[0], B = pts[n - 1];
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  let side = 0;
  for (const p of pts.slice(1, -1)) {
    const s = ((p.x - A.x) * dy - (p.y - A.y) * dx) / len;   // which side of A->B, and how far
    side += s;
  }
  const preferred = n === 2 ? -1 : side > 0 ? 1 : -1;

  // the shallowest bow (preferred side first) whose tag touches no name, person or fact tag
  const others = [
    ...labels.map((l) => l.box),
    ...pts.map((p) => ({ x: p.x - R - 4, y: p.y - R - 4, w: 2 * R + 8, h: 2 * R + 8 })),
    ...facts.map((f) => f.tag),
  ];
  const hits = (b) => others.some((o) => b.x < o.x + o.w + 6 && o.x < b.x + b.w + 6 && b.y < o.y + o.h + 6 && o.y < b.y + b.h + 6);
  const base = n === 2 ? 52 : 56;   // it bows away from the people in between, so it need not clear them
  let ans = null;
  search: for (let extra = 0; extra <= 280; extra += 14) {
    for (const sign of [preferred, -preferred]) {
      const a = arrow(A, B, sign * (base + extra));
      const t = box(a.mid.x, a.mid.y, answerW, TAG_H);
      if (t.x >= edge / 2 && t.x + t.w <= width - edge / 2 && !hits(t)) { ans = a; break search; }
    }
  }
  // no bow fits inside the frame: make room at the sides and lay out again
  if (!ans && extraPad < 240) return solutionLayout(boxWidth, words, nameW, tagW, answerW, extraPad + 40);
  ans ??= arrow(A, B, preferred * (base + 280));
  const answer = { d: ans.d, head: ans.head, tag: box(ans.mid.x, ans.mid.y, answerW, TAG_H) };

  // vertical fit: the caller shifts the drawing down by `shift` if anything rises above the top
  const tops = [answer.tag.y, ...facts.map((f) => f.tag.y), ...labels.map((l) => l.box.y), ...pts.map((p) => p.y - R)];
  const shift = Math.max(0, MARGIN - Math.min(...tops));
  const bottoms = [answer.tag.y + TAG_H, ...facts.map((f) => f.tag.y + TAG_H), ...labels.map((l) => l.box.y + l.box.h), ...pts.map((p) => p.y + R)];
  const height = Math.ceil(Math.max(...bottoms) + shift + MARGIN + 8);
  const rows = [];
  for (let g = maxG; g >= minG; g--) rows.push({ gen: g, y: top + (maxG - g) * ROW + shift });
  return { compact, width, natural, height, shift, pts, labels, facts, answer, rows };
}
