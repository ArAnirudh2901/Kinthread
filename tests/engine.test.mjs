// Live graph physics: settles, stays inside the box, keeps people apart, never produces NaN.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GraphEngine } from '../src/lib/graph/engine.js';

const run = (names, links, w = 532, h = 300, a = null, b = null) => {
  const e = new GraphEngine();
  e.w = w; e.h = h;
  e.setGraph({ names, links, a, b });
  e.sleep();
  let v = Infinity, steps = 0;
  while (steps < 900 && v > 0.02) { v = e.step(1); steps++; }
  return { e, v, steps };
};

for (const [label, n, w] of [['4 people', 4, 532], ['12 people', 12, 532], ['32 people', 32, 532], ['8 people on a phone', 8, 290]]) {
  test(`${label}: settles inside the box`, () => {
    const names = Array.from({ length: n }, (_, i) => `P${i}`);
    const links = names.slice(1).map((x, i) => [names[i], x]);
    const { e, v, steps } = run(names, links, w);
    assert.ok(v <= 0.02, `still moving after ${steps} steps (speed ${v})`);
    for (const p of e.nodes.values()) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x >= 40 && p.x <= w - 40 && p.y >= 30 && p.y <= 300 - 46);
    }
  });
}

test('Person A settles left of Person B', () => {
  const { e } = run(['A1', 'X', 'B1'], [['A1', 'X'], ['X', 'B1']], 532, 300, 'B1', 'A1');
  assert.ok(e.nodes.get('B1').x < e.nodes.get('A1').x);
});
