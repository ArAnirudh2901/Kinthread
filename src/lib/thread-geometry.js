// Threadline layout: where people sit, how the thread curves, where relation tags go.
// Pure functions of the container width and label widths (measured by the caller), unit-tested in
// tests/thread.test.mjs for overlaps and bounds. Three layouts:
//   row    - everyone on one line (enough width)
//   snake  - rows that turn back at the ends (long chains on wide screens)
//   column - one person per line (phones)

export const ARC = 38;          // rise of an edge between neighbours on one row
export const ROW_H = 132;       // distance between snake rows
export const COL_GAP = 92;      // distance between people in a column
export const TOP = 86;          // first row: room above for the relation tags
export const TAG_H = 22;
const NAME_GAP = 16;            // minimum space between two neighbours' name labels
const TAG_GAP = 20;             // minimum space around a tag
const NAME_Y = 34;              // name baseline below a person
const TURN = 46;                // how far a snake turn bulges past the row end

/**
 * @param {number} width   container width in px
 * @param {number[]} names label width of each person (px), endpoints include their role line
 * @param {number[]} tags  width of each relation tag (px), one per edge
 */
export function layoutThread(width, names, tags) {
  const n = names.length;
  if (n === 1) return withEdges('row', width, 150, [{ x: width / 2, y: 64 }], tags);

  let need = 0;
  for (let i = 0; i < n - 1; i++) need = Math.max(need, (names[i] + names[i + 1]) / 2 + NAME_GAP, tags[i] + TAG_GAP);
  const pad = Math.max(48, Math.max(...names) / 2 + 6);
  const span = width - 2 * pad;
  const perRow = span > 0 ? Math.floor(span / need) + 1 : 1;

  if (perRow >= n) {
    const gap = span / (n - 1);
    const pts = names.map((_, i) => ({ x: pad + i * gap, y: TOP }));
    return withEdges('row', width, TOP + 70, pts, tags);
  }
  if (perRow >= 3) {
    const gap = span / (perRow - 1);
    const pts = names.map((_, i) => {
      const r = Math.floor(i / perRow), c = i % perRow;
      return { x: r % 2 === 0 ? pad + c * gap : width - pad - c * gap, y: TOP + r * ROW_H };
    });
    return withEdges('snake', width, pts[n - 1].y + 70, pts, tags);
  }
  const pts = names.map((_, i) => ({ x: 34, y: 34 + i * COL_GAP }));
  return withEdges('column', width, pts[n - 1].y + 44, pts, tags);
}

function withEdges(mode, width, height, pts, tags) {
  const edges = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], w = tags[i];
    let d, ax, ay;
    if (mode === 'column') {
      const dy = q.y - p.y, out = ARC * 1.2;
      d = `M${p.x} ${p.y}C${p.x + out} ${p.y + dy * 0.3} ${q.x + out} ${q.y - dy * 0.3} ${q.x} ${q.y}`;
      ax = p.x + ARC * 0.9 - 10 + w / 2;   // tag starts just left of the curve's outermost point
      ay = (p.y + q.y) / 2;
    } else if (p.y === q.y) {
      const dx = q.x - p.x;
      d = `M${p.x} ${p.y}C${p.x + dx * 0.32} ${p.y - ARC} ${q.x - dx * 0.32} ${q.y - ARC} ${q.x} ${q.y}`;
      ax = (p.x + q.x) / 2;
      ay = p.y - ARC * 0.75;
    } else {
      const side = p.x > width / 2 ? 1 : -1, dy = q.y - p.y;
      d = `M${p.x} ${p.y}C${p.x + side * TURN} ${p.y + dy * 0.2} ${q.x + side * TURN} ${q.y - dy * 0.2} ${q.x} ${q.y}`;
      ax = p.x + side * TURN * 0.75;
      ay = (p.y + q.y) / 2;
    }
    const x = Math.min(Math.max(ax - w / 2, 4), width - w - 4);
    edges.push({ d: round(d), tag: { x: r1(x), y: r1(ay - TAG_H / 2), w, h: TAG_H, cx: r1(x + w / 2), cy: r1(ay) } });
  }
  return { mode, width, height: Math.ceil(height), pts: pts.map((p) => ({ x: r1(p.x), y: r1(p.y) })), edges };
}

/** Where a person's name label goes. */
export function nameAt(mode, p, endpoint) {
  return mode === 'column'
    ? { x: p.x + (endpoint ? 22 : 16), y: p.y + 5, anchor: 'start' }
    : { x: p.x, y: p.y + (endpoint ? NAME_Y : NAME_Y - 6), anchor: 'middle' };
}

/** Animation timing in seconds. mode: 'full' | 'lite' (slow devices) | 'none' (reduced motion). */
export function threadTiming(edgeCount, mode) {
  if (mode === 'none') return { t0: 0, seg: 0, settle: 0 };
  const total = mode === 'lite' ? 0.36 : 0.75;            // whole draw, however long the chain
  const seg = Math.min(mode === 'lite' ? 0.12 : 0.34, Math.max(mode === 'lite' ? 0.06 : 0.16, total / Math.max(1, edgeCount)));
  const t0 = mode === 'lite' ? 0.04 : 0.1;
  return { t0, seg, settle: t0 + Math.max(0.15, (edgeCount - 0.4) * seg) };
}

const r1 = (v) => Math.round(v * 10) / 10;
const round = (d) => d.replace(/-?\d+\.\d+/g, (m) => String(r1(+m)));
