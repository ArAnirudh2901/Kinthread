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
