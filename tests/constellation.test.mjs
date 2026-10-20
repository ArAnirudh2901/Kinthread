import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConstellation } from '../src/lib/constellation-graph.js';

for (const lite of [false, true]) {
  test(`constellation (${lite ? 'lite' : 'full'}): connected thread, top-down order, small enough for one draw call`, () => {
    const g = buildConstellation({ lite });
    assert.ok(g.nodes.length >= (lite ? 8 : 25) && g.nodes.length <= (lite ? 40 : 90), `${g.nodes.length} people`);
    assert.ok(g.edges.length * 4 < 65536, 'fits 16-bit indices');
    // the lit thread goes from the ancestor to the leaf, each step parent to child
    assert.ok(g.path.length >= 2);
    assert.equal(g.edges[g.path[0]].a, g.top);
    assert.equal(g.edges[g.path[g.path.length - 1]].b, g.leaf);
    for (let i = 1; i < g.path.length; i++) assert.equal(g.edges[g.path[i]].a, g.edges[g.path[i - 1]].b);
    // weaving order: generations never go backwards
    for (let i = 1; i < g.edges.length; i++) assert.ok(g.edges[i].gen >= g.edges[i - 1].gen);
    for (const n of g.nodes) assert.ok(Math.abs(n.x) < 1.6 && Math.abs(n.y) <= 1 && Math.abs(n.z) < 1.6);
  });
}

test('constellation is deterministic', () => {
  assert.deepEqual(buildConstellation(), buildConstellation());
});
