// The loader's neural-network cone: straight cone sides, full connections between neighbouring layers, a valid path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNeuralCone } from '../src/lib/constellation-graph.js';

for (const lite of [false, true]) {
  test(`cone (${lite ? 'lite' : 'full'}): every neuron on the cone surface, layers fully connected`, () => {
    const { nodes, edges, path, top, leaf, layers } = buildNeuralCone({ lite });
    const apex = nodes[top], baseY = nodes[layers.at(-1)[0]].y;
    const slope = Math.hypot(nodes[layers.at(-1)[0]].x, nodes[layers.at(-1)[0]].z) / (apex.y - baseY);
    for (const n of nodes) {
      // radius grows in proportion to the distance below the apex: straight sides
      assert.ok(Math.abs(Math.hypot(n.x, n.z) - slope * (apex.y - n.y)) < 1e-9, 'neuron off the cone surface');
    }
    for (let k = 0; k + 1 < layers.length; k++) {
      for (const a of layers[k]) for (const b of layers[k + 1]) {
        assert.ok(edges.some((e) => e.a === a && e.b === b), `missing ${a}->${b}`);
      }
    }
    const expected = layers.slice(1).reduce((n, l, k) => n + l.length * layers[k].length, 0);
    assert.equal(edges.length, expected);
    assert.equal(path.length, layers.length - 1);
    assert.ok(path.every((e) => e >= 0));
    assert.equal(edges[path[0]].a, top);
    assert.equal(edges[path.at(-1)].b, leaf);
    path.slice(1).forEach((e, i) => assert.equal(edges[e].a, edges[path[i]].b, 'path not continuous'));
  });
}
