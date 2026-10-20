// The 3D scene's graph: a neural-network cone (hero and model loader share it).

/**
 * The neural network: a cone of fully connected layers, like a neural network. One neuron at the apex, then rings
 * whose radius grows in proportion to depth, so every neuron lies on the cone's surface; each neuron is connected to
 * every neuron in the layers before and after it. `path` runs down one side of the cone (the answer's thread).
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
