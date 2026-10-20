// A procedural family "constellation" for the 3D scenes: generations stacked top to bottom, couples
// joined, children below a parent, and one lit thread running from an ancestor down to a descendant.
// Pure and seeded (same picture every visit); unit-tested in tests/constellation.test.mjs.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @returns {{ nodes: {x,y,z,gen}[], edges: {a,b,kind,gen}[], path: number[], top: number, leaf: number }}
 * edges are ordered top-down (weaving order); path lists edge indices from `top` to `leaf`.
 */
export function buildConstellation({ generations = 4, seed = 11, lite = false } = {}) {
  const rand = mulberry32(seed);
  const G = lite ? 3 : generations;
  const nodes = [];
  const edges = [];
  const parentEdge = new Map();
  const yOf = (g) => 0.95 - g * (1.9 / (G - 1));
  const ring = (g) => 0.28 + g * 0.3;
  const add = (angle, r, y, gen) => {
    nodes.push({ x: Math.cos(angle) * r, y, z: Math.sin(angle) * r, gen });
    return nodes.length - 1;
  };

  let couples = [];
  for (let c = 0; c < 2; c++) {
    const a = c * Math.PI + 0.4 + rand() * 0.5;
    const p = [add(a - 0.22, ring(0), yOf(0), 0), add(a + 0.22, ring(0), yOf(0), 0)];
    edges.push({ a: p[0], b: p[1], kind: 'spouse', gen: 0 });
    couples.push({ a, p });
  }
  for (let g = 1; g < G; g++) {
    const next = [];
    for (const cp of couples) {
      const kids = (lite ? 1 : 2) + Math.floor(rand() * 2);
      for (let k = 0; k < kids; k++) {
        const a = cp.a + (k - (kids - 1) / 2) * (1.1 / g) + (rand() - 0.5) * 0.18;
        const r = ring(g) + (rand() - 0.5) * 0.1;
        const y = yOf(g) + (rand() - 0.5) * 0.08;
        const child = add(a, r, y, g);
        edges.push({ a: cp.p[k % 2], b: child, kind: 'parent', gen: g });
        parentEdge.set(child, edges.length - 1);
        if (g < G - 1 && (next.length === 0 || rand() < 0.65)) {
          const spouse = add(a + 0.2, r + 0.06, y, g);
          edges.push({ a: child, b: spouse, kind: 'spouse', gen: g });
          next.push({ a: a + 0.1, p: [child, spouse] });
        }
      }
    }
    couples = next;
  }

  // the lit thread: the longest unbroken line from an ancestor down to a descendant (married-in
  // spouses have no parents, so some lines stop early)
  const chain = (leafNode) => {
    const p = [];
    let c = leafNode;
    while (parentEdge.has(c)) { const e = parentEdge.get(c); p.unshift(e); c = edges[e].a; }
    return { p, top: c };
  };
  let leaf = -1, best = { p: [], top: -1 };
  nodes.forEach((n, i) => {
    if (!parentEdge.has(i)) return;
    const c = chain(i);
    if (c.p.length > best.p.length || (c.p.length === best.p.length && leaf >= 0 && n.x - n.z > nodes[leaf].x - nodes[leaf].z)) { best = c; leaf = i; }
  });
  const path = best.p;
  const cur = best.top;
  return { nodes, edges, path, top: cur, leaf };
}

/**
 * The loader's network: a cone of fully connected layers, like a neural network. One neuron at the apex, then rings
 * whose radius grows in proportion to depth, so every neuron lies on the cone's surface; each neuron is connected to
 * every neuron in the layers before and after it. `path` runs down one side of the cone (the answer's red thread).
 * @returns {{ nodes: {x,y,z,gen}[], edges: {a,b,kind,gen}[], path: number[], top: number, leaf: number, layers: number[][] }}
 */
export function buildNeuralCone({ lite = false } = {}) {
  const sizes = lite ? [1, 3, 5, 8] : [1, 3, 6, 9, 12];
  const L = sizes.length, height = 2.2, base = 1.1;   // apex at +1.1, base ring at -1.1, base radius 1.1
  const nodes = [], layers = [];
  sizes.forEach((count, k) => {
    const depth = k / (L - 1), y = height / 2 - depth * height, r = base * depth;   // straight cone sides
    const offset = k * 0.45;   // stagger rings so connections do not overlap from the front
    layers.push(sizes[k] === 1 ? [nodes.push({ x: 0, y, z: 0, gen: k }) - 1]
      : Array.from({ length: count }, (_, j) => {
        const a = offset + (j / count) * Math.PI * 2;
        return nodes.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, gen: k }) - 1;
      }));
  });
  const edges = [];
  for (let k = 0; k + 1 < L; k++) {
    for (const a of layers[k]) for (const b of layers[k + 1]) edges.push({ a, b, kind: 'parent', gen: k + 1 });
  }
  // the answer path: down the side nearest one direction
  const dirAngle = 0.3;
  const angleOf = (i) => Math.atan2(nodes[i].z, nodes[i].x);
  const near = (layer) => layer.reduce((best, i) => (Math.abs(Math.atan2(Math.sin(angleOf(i) - dirAngle), Math.cos(angleOf(i) - dirAngle)))
    < Math.abs(Math.atan2(Math.sin(angleOf(best) - dirAngle), Math.cos(angleOf(best) - dirAngle))) ? i : best), layer[0]);
  const chain = layers.map((layer) => (layer.length === 1 ? layer[0] : near(layer)));
  const path = [];
  for (let k = 0; k + 1 < chain.length; k++) path.push(edges.findIndex((e) => e.a === chain[k] && e.b === chain[k + 1]));
  return { nodes, edges, path, top: chain[0], leaf: chain.at(-1), layers };
}
