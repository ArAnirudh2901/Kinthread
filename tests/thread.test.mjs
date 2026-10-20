// Graph builder: every layout keeps labels apart and inside the container, for any chain length and width.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutThread, nameAt, threadTiming } from '../src/lib/thread-geometry.js';

const NAME = 124;                    // widest name label after truncation
const TAG = 13 * 7 + 20;             // "granddaughter", the longest relation word
const boxes = (L) => {
  const out = [];
  L.pts.forEach((p, i) => {
    const end = i === 0 || i === L.pts.length - 1;
    const r = end ? 13 : 6.5;
    out.push({ kind: `node${i}`, x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r });
    const a = nameAt(L.mode, p, end);
    const x = a.anchor === 'middle' ? a.x - NAME / 2 : a.x;
    out.push({ kind: `name${i}`, x, y: a.y - 12, w: NAME, h: end ? 30 : 16 });
  });
  L.edges.forEach((e, i) => out.push({ kind: `tag${i}`, x: e.tag.x, y: e.tag.y, w: e.tag.w, h: e.tag.h }));
  return out;
};
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const width of [280, 320, 390, 480, 560, 720, 960, 1200]) {
  for (let n = 2; n <= 11; n++) {
    test(`${n} people at ${width}px`, () => {
      const L = layoutThread(width, Array(n).fill(NAME), Array(n - 1).fill(TAG));
      assert.equal(L.pts.length, n);
      assert.equal(L.edges.length, n - 1);
      const bs = boxes(L);
      for (const b of bs) {
        assert.ok(b.x >= 0 && b.x + b.w <= width + 0.5, `${b.kind} outside 0..${width} (${L.mode}) at x=${b.x} w=${b.w}`);
        assert.ok(b.y >= 0 && b.y + b.h <= L.height + 0.5, `${b.kind} outside height ${L.height} (${L.mode})`);
      }
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        if (bs[i].kind.startsWith('node') && bs[j].kind.startsWith(`name${bs[i].kind.slice(4)}`)) continue;
        assert.ok(!overlap(bs[i], bs[j]), `${bs[i].kind} overlaps ${bs[j].kind} (${L.mode}, ${n} people, ${width}px)`);
      }
    });
  }
}

test('layout choice: one row when it fits, snake for long chains, column on phones', () => {
  assert.equal(layoutThread(560, [60, 60, 60], [80, 80]).mode, 'row');
  assert.equal(layoutThread(560, Array(7).fill(80), Array(6).fill(80)).mode, 'snake');
  assert.equal(layoutThread(320, Array(5).fill(NAME), Array(4).fill(TAG)).mode, 'column');
});

test('timing: the whole draw stays short and reduced motion draws instantly', () => {
  for (let e = 1; e <= 10; e++) {
    const t = threadTiming(e, 'full');
    assert.ok(t.t0 + e * t.seg <= 1.75, `full draw too long for ${e} edges`);
    assert.ok(threadTiming(e, 'lite').settle < t.settle);
  }
  assert.deepEqual(threadTiming(4, 'none'), { t0: 0, seg: 0, settle: 0 });
});
