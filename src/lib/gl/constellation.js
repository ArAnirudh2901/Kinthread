// 3D neural-network cone in raw WebGL (1 or 2; no library). One draw call for all threads (screen-space
// thick lines built from triangles), one for people (soft point sprites), one for light pulses.
// Per frame the CPU only updates a 4x4 matrix and at most 8 pulse points.
//   variant 'hero':  fully woven in the answer colour; slow turn, follows the pointer, pulses run down the answer path
//   variant 'weave': threads appear top-down as `progress` goes 0 -> 1 (model download)
// Stops when off screen or the tab is hidden; draws one still frame for reduced motion.
import { buildNeuralCone } from '../constellation-graph.js';

const LINE_VS = `
attribute vec3 a_pos; attribute vec3 a_other; attribute float a_side; attribute vec4 a_color; attribute float a_width;
uniform mat4 u_mvp; uniform vec2 u_half; uniform float u_dpr; uniform vec2 u_fog;
varying vec4 v_color;
void main() {
  vec4 p = u_mvp * vec4(a_pos, 1.0);
  vec4 q = u_mvp * vec4(a_other, 1.0);
  vec2 d = q.xy / q.w * u_half - p.xy / p.w * u_half;
  vec2 n = normalize(vec2(-d.y, d.x) + 1e-6);
  p.xy += n * a_side * a_width * u_dpr * 0.5 / u_half * p.w;
  gl_Position = p;
  float fog = clamp((u_fog.y - p.w) / (u_fog.y - u_fog.x), 0.18, 1.0);
  v_color = vec4(a_color.rgb, a_color.a * fog);
}`;
const POINT_VS = `
attribute vec3 a_pos; attribute vec4 a_color; attribute float a_size;
uniform mat4 u_mvp; uniform float u_dpr; uniform vec2 u_fog;
varying vec4 v_color;
void main() {
  vec4 p = u_mvp * vec4(a_pos, 1.0);
  gl_Position = p;
  gl_PointSize = a_size * u_dpr * 3.6 / p.w;
  float fog = clamp((u_fog.y - p.w) / (u_fog.y - u_fog.x), 0.25, 1.0);
  v_color = vec4(a_color.rgb, a_color.a * fog);
}`;
// premultiplied output: the canvas is transparent and composited over the page in either theme
const LINE_FS = `precision mediump float; varying vec4 v_color; uniform float u_alpha; void main() { gl_FragColor = vec4(v_color.rgb * v_color.a, v_color.a) * u_alpha; }`;
const POINT_FS = `precision mediump float; varying vec4 v_color; uniform float u_alpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.36, d) + smoothstep(0.5, 0.0, d) * 0.35;
  if (a < 0.02) discard;
  float o = v_color.a * min(a, 1.0);
  gl_FragColor = vec4(v_color.rgb * o, o) * u_alpha;
}`;

const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, a];
// dark: light threads glowing additively; light: ink threads laid over paper
const PALETTES = {
  dark: { thread: hex('#a9b9ae', 0.16), lit: hex('#f3d34a', 0.9), copper: hex('#e4ebe2', 1), lichen: hex('#f3d34a', 1), pulse: hex('#fff7d1', 1), additive: true },
  light: { thread: hex('#14231b', 0.13), lit: hex('#7d5f00', 0.85), copper: hex('#2e4237', 1), lichen: hex('#7d5f00', 1), pulse: hex('#7d5f00', 1), additive: false },
};
const FOVY = 0.62;
const FILL = 0.8;
const SPIN_TAU = 5;    // hero spin decays over ~3 tau, then the scene rests (no endless loop)
const PULSE_END = 9;   // seconds the light keeps running down the thread
   // share of the narrower half field of view the family may use (the rest is margin)
const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function modelView(yaw, pitch, dist) {   // translate(0,0,-dist) * rotX(pitch) * rotY(yaw)
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return new Float32Array([cy, sp * sy, -cp * sy, 0, 0, cp, sp, 0, sy, -sp * cy, cp * cy, 0, 0, 0, -dist, 1]);
}

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

/** Returns a controller, or null when WebGL is unavailable (the canvas then stays a plain background). */
export function createConstellation(canvas, { variant = 'hero', lite = false, still = false, onWoven } = {}) {
  // a cone of fully connected layers; the hero shows it woven, the loader weaves it as bytes arrive
  const graph = buildNeuralCone({ lite });
  const { nodes, edges, path } = graph;
  // centre the family on its middle, and measure the sphere it turns in, so the camera can fit any canvas shape
  const mid = ['x', 'y', 'z'].map((k) => (Math.min(...nodes.map((n) => n[k])) + Math.max(...nodes.map((n) => n[k]))) / 2);
  for (const n of nodes) { n.x -= mid[0]; n.y -= mid[1]; n.z -= mid[2]; }
  const radius = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y, n.z))) + 0.05;
  const onPath = new Set(path);
  const pathNodes = new Set([graph.top, ...path.map((e) => edges[e].b)]);
  let C = PALETTES[themeNow()];
  let gl, line, point, buf = {};
  let progress = variant === 'weave' ? 0 : 1, target = progress;
  let running = false, visible = true, raf = 0, last = 0, lost = false;
  const t0 = performance.now();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  // nodes in the order their first thread appears, so weaving reveals people with their threads
  // weave order: breadth-first from the top ancestor, so every new thread starts at someone already drawn and grows
  // outward (one continuous web, never a thread in empty space). dir[k] = [from, to]; firstEdge[i] = the rank of the
  // thread that reaches person i (-1 for the ones the weave starts from)
  const order = [], dir = new Array(edges.length), firstEdge = new Array(nodes.length).fill(-1);
  {
    const seen = new Set(), used = new Set(), adj = nodes.map(() => []);
    edges.forEach((e, k) => { adj[e.a].push(k); adj[e.b].push(k); });
    for (const seed of [graph.top, ...nodes.keys()]) {
      if (seen.has(seed)) continue;
      seen.add(seed);
      const queue = [seed];
      while (queue.length) {
        const n = queue.shift();
        for (const k of adj[n]) {
          if (used.has(k)) continue;
          used.add(k);
          const other = edges[k].a === n ? edges[k].b : edges[k].a;
          dir[k] = [n, other];
          order.push(k);
          if (!seen.has(other)) { seen.add(other); firstEdge[other] = order.length - 1; queue.push(other); }
        }
      }
    }
  }
  const nodeOrder = nodes.map((_, i) => i).sort((a, b) => firstEdge[a] - firstEdge[b]);
  // the loader: woven threads and the people they reach take the answer colour, so the network grows out of the first person;
  // threads still to come wait in neutral grey. The answer path stays the brightest and thickest.
  const withAlpha = (c, a) => [c[0], c[1], c[2], c[3] * a];
  const weave = variant === 'weave';
  const edgeStyle = (k) => ({
    // soft yellow: the answer path carries the colour, the rest is a faint wash (stronger while weaving, so woven
    // threads stay clearly ahead of the grey ones still to come)
    col: onPath.has(k) ? C.lit : withAlpha(C.lit, weave ? 0.5 : C.additive ? 0.2 : 0.68),   // ink on paper does not add up: stronger
    w: onPath.has(k) ? 2.4 : 1.4,
  });
  const nodeStyle = (i) => ({
    col: i === graph.top ? C.copper : pathNodes.has(i) || weave || !C.additive ? C.lichen : withAlpha(C.lichen, 0.7),
    size: i === graph.top || i === graph.leaf ? 9 : pathNodes.has(i) ? 6.5 : 5,
  });
  let woven = false;

  function init() {
    const opts = { antialias: !lite, alpha: true, premultipliedAlpha: true, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: false };
    gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl) return false;
    line = { prog: compile(gl, LINE_VS, LINE_FS) };
    point = { prog: compile(gl, POINT_VS, POINT_FS) };
    for (const [p, names] of [[line, ['a_pos', 'a_other', 'a_side', 'a_color', 'a_width']], [point, ['a_pos', 'a_color', 'a_size']]]) {
      p.attr = Object.fromEntries(names.map((n) => [n, gl.getAttribLocation(p.prog, n)]));
      p.uni = Object.fromEntries(['u_mvp', 'u_half', 'u_dpr', 'u_fog', 'u_alpha'].map((n) => [n, gl.getUniformLocation(p.prog, n)]));
    }
    buf.lv = gl.createBuffer();
    buf.li = gl.createBuffer();
    buf.pv = gl.createBuffer();
    buf.lg = gl.createBuffer();   // weave: threads still to come
    buf.pg = gl.createBuffer();   // weave: people not reached yet
    buf.grow = gl.createBuffer();
    buf.bloom = gl.createBuffer();   // the person a growing thread is about to reach   // the one thread being drawn right now
    buf.pulse = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf.pulse); gl.bufferData(gl.ARRAY_BUFFER, 8 * 8 * 4, gl.DYNAMIC_DRAW);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    upload();
    return true;
  }

  // colours live in the vertex data: rebuilt (a few KB) when the theme changes
  function upload() {
    // threads: 4 vertices per edge, 12 floats each
    const lv = new Float32Array(edges.length * 4 * 12), lg = new Float32Array(edges.length * 4 * 12), li = new Uint16Array(edges.length * 6);
    const waiting = withAlpha(C.thread, 1.2);   // weave: threads not woven yet
    edges.forEach((e, k) => {
      const A = nodes[e.a], B = nodes[e.b], { col, w } = edgeStyle(k, e);
      const verts = [[A, B, 1], [A, B, -1], [B, A, -1], [B, A, 1]];
      verts.forEach(([p, q, s], j) => {
        lv.set([p.x, p.y, p.z, q.x, q.y, q.z, s, ...col, w], (k * 4 + j) * 12);
        lg.set([p.x, p.y, p.z, q.x, q.y, q.z, s, ...waiting, 1.1], (k * 4 + j) * 12);
      });
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.lg); gl.bufferData(gl.ARRAY_BUFFER, lg, gl.STATIC_DRAW);
    order.forEach((k, r) => li.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 1, k * 4 + 3, k * 4 + 2], r * 6));   // drawn in weave order
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.lv); gl.bufferData(gl.ARRAY_BUFFER, lv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.li); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, li, gl.STATIC_DRAW);
    // people: 8 floats each
    const pv = new Float32Array(nodes.length * 8), pg = new Float32Array(nodes.length * 8);
    nodeOrder.forEach((i, k) => {
      const n = nodes[i], { col, size } = nodeStyle(i);
      pv.set([n.x, n.y, n.z, ...col, size], k * 8);
      pg.set([n.x, n.y, n.z, ...withAlpha(C.thread, 3), size * 0.8], k * 8);   // weave: people not reached yet
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pv); gl.bufferData(gl.ARRAY_BUFFER, pv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pg); gl.bufferData(gl.ARRAY_BUFFER, pg, gl.STATIC_DRAW);
    // dark: additive, threads glow where they cross; light: ordinary "over" blending
    if (C.additive) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  function bind(p, stride, layout) {
    gl.useProgram(p.prog);
    let off = 0;
    for (const [name, size] of layout) {
      const loc = p.attr[name];
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off * 4);
      off += size;
    }
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return dpr;
  }

  function draw(now) {
    if (!gl || lost) return;
    const dpr = size();
    const t = Math.max(0, (now - t0) / 1000);   // a frame's timestamp can predate t0 by a few ms
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const spin = variant === 'hero' ? 0.07 * SPIN_TAU * (1 - Math.exp(-t / SPIN_TAU)) : t * 0.07;
    const yaw = (still ? 0.6 : 0.6 + spin) + pointer.x * 0.35;
    const pitch = 0.3 + pointer.y * 0.12;
    // distance at which the turning family stays inside the narrower of the two fields of view, at every aspect ratio
    const aspect = canvas.width / canvas.height;
    const half = Math.atan(Math.min(Math.tan(FOVY / 2), Math.tan(FOVY / 2) * aspect));
    const dist = radius / Math.sin(half * (variant === 'weave' ? 0.96 : FILL));   // the loader is the whole stage
    const mvp = mul(mat4Perspective(FOVY, aspect, 0.1, dist + radius + 2), modelView(yaw, pitch, dist));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (variant === 'weave') {
      // the weave is the download: exactly its progress (reported every ~32 ms), so it reaches 100% with it, never later
      progress = target;
      canvas.dataset.weave = progress.toFixed(3);   // observable progress (tests, debugging)
      if (progress >= 1 && !woven) { woven = true; onWoven?.(); }
    }
    const shownEdges = Math.floor(progress * edges.length + 1e-6);
    const grow = variant === 'weave' ? progress * edges.length - shownEdges : 0;
    bind(line, 12, [['a_pos', 3], ['a_other', 3], ['a_side', 1], ['a_color', 4], ['a_width', 1]]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.lv);
    bind(line, 12, [['a_pos', 3], ['a_other', 3], ['a_side', 1], ['a_color', 4], ['a_width', 1]]);
    gl.uniformMatrix4fv(line.uni.u_mvp, false, mvp);
    gl.uniform2f(line.uni.u_half, canvas.width / 2, canvas.height / 2);
    gl.uniform1f(line.uni.u_dpr, dpr);
    gl.uniform2f(line.uni.u_fog, dist - radius * 0.7, dist + radius * 0.8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.li);
    // weave: the whole family is there from the start, faint; threads come to full strength as the model arrives
    const ghost = weave && progress < 1;
    gl.uniform1f(line.uni.u_alpha, 1);
    if (ghost && shownEdges < edges.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.lg);
      bind(line, 12, [['a_pos', 3], ['a_other', 3], ['a_side', 1], ['a_color', 4], ['a_width', 1]]);
      gl.drawElements(gl.TRIANGLES, (edges.length - shownEdges) * 6, gl.UNSIGNED_SHORT, shownEdges * 6 * 2);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.lv);
      bind(line, 12, [['a_pos', 3], ['a_other', 3], ['a_side', 1], ['a_color', 4], ['a_width', 1]]);
    }
    if (shownEdges) gl.drawElements(gl.TRIANGLES, shownEdges * 6, gl.UNSIGNED_SHORT, 0);
    // the next thread grows from its first person toward the second instead of appearing whole
    let tip = null;
    if (grow > 0.001 && shownEdges < edges.length) {
      const k = order[shownEdges], e = edges[k], A = nodes[dir[k][0]], B = nodes[dir[k][1]], f = 1 - (1 - grow) ** 2;
      tip = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, z: A.z + (B.z - A.z) * f };
      const { col, w } = edgeStyle(k, e);
      const gv = new Float32Array(48);
      [[A, tip, 1], [A, tip, -1], [tip, A, -1], [tip, A, 1]].forEach(([p, q, sd], j) => gv.set([p.x, p.y, p.z, q.x, q.y, q.z, sd, ...col, w], j * 12));
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.grow);
      gl.bufferData(gl.ARRAY_BUFFER, gv, gl.DYNAMIC_DRAW);
      bind(line, 12, [['a_pos', 3], ['a_other', 3], ['a_side', 1], ['a_color', 4], ['a_width', 1]]);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);   // indices 0-3 of the shared index buffer
    }
    disable(line);

    const shownNodes = progress >= 1 ? nodes.length : nodeOrder.filter((i) => firstEdge[i] < shownEdges).length;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pv);
    bind(point, 8, [['a_pos', 3], ['a_color', 4], ['a_size', 1]]);
    gl.uniformMatrix4fv(point.uni.u_mvp, false, mvp);
    gl.uniform1f(point.uni.u_dpr, dpr);
    gl.uniform2f(point.uni.u_fog, dist - radius * 0.7, dist + radius * 0.8);
    gl.uniform1f(point.uni.u_alpha, 1);
    if (ghost && shownNodes < nodes.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pg);
      bind(point, 8, [['a_pos', 3], ['a_color', 4], ['a_size', 1]]);
      gl.drawArrays(gl.POINTS, shownNodes, nodes.length - shownNodes);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pv);
      bind(point, 8, [['a_pos', 3], ['a_color', 4], ['a_size', 1]]);
    }
    if (shownNodes) gl.drawArrays(gl.POINTS, 0, shownNodes);
    // the person at the end of the growing thread blooms in as the thread arrives
    if (grow > 0.6 && shownEdges < edges.length) {
      const to = dir[order[shownEdges]][1];
      if (firstEdge[to] === shownEdges) {
        const f = Math.min(1, (grow - 0.6) / 0.4), n = nodes[to], { col, size } = nodeStyle(to);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.bloom);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([n.x, n.y, n.z, ...col, size * (0.4 + 0.6 * f)]), gl.DYNAMIC_DRAW);
        bind(point, 8, [['a_pos', 3], ['a_color', 4], ['a_size', 1]]);
        gl.uniform1f(point.uni.u_alpha, f);
        gl.drawArrays(gl.POINTS, 0, 1);
        gl.uniform1f(point.uni.u_alpha, 1);
      }
    }

    // pulses: light travelling down the lit thread (hero) or at the newest thread (weave)
    const pulses = [];
    if (!still) {
      if (variant === 'hero' && path.length) {
        for (let k = 0; k < 3; k++) {
          const u = ((t * 0.22 + k / 3) % 1) * path.length;
          const e = edges[path[Math.min(path.length - 1, Math.floor(u))]], f = u % 1;
          const A = nodes[e.a], B = nodes[e.b];
          pulses.push([A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f, A.z + (B.z - A.z) * f]);
        }
      } else if (tip) {
        pulses.push([tip.x, tip.y, tip.z]);   // a light at the tip of the thread being drawn
      }
    }
    if (pulses.length) {
      const pd = new Float32Array(pulses.length * 8);
      const fade = variant === 'hero' ? Math.max(0, Math.min(1, PULSE_END - t)) : 1;   // premultiplied: scale all four
      pulses.forEach((p, k) => pd.set([...p, ...C.pulse.map((c) => c * fade), 7], k * 8));
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pulse);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pd);
      bind(point, 8, [['a_pos', 3], ['a_color', 4], ['a_size', 1]]);
      gl.drawArrays(gl.POINTS, 0, pulses.length);
    }
    disable(point);
  }

  function disable(p) { for (const loc of Object.values(p.attr)) gl.disableVertexAttribArray(loc); }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (lite && now - last < 33) return;   // ~30 fps on slow devices
    last = now;
    draw(now);
    // at rest: spin decayed, light gone, pointer caught up. Stop drawing until something changes
    if (variant === 'hero' && (now - t0) / 1000 > Math.max(PULSE_END, SPIN_TAU * 3) &&
      Math.abs(pointer.tx - pointer.x) < 1e-3 && Math.abs(pointer.ty - pointer.y) < 1e-3) stop();
  }
  function start() {
    if (running || still || lost || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  try { if (!init()) return null; } catch { return null; }

  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }) : null;
  io?.observe(canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!running) draw(performance.now()); }) : null;
  ro?.observe(canvas);
  const fine = variant === 'hero' && !still && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onMove = (e) => { pointer.tx = (e.clientX / innerWidth) * 2 - 1; pointer.ty = (e.clientY / innerHeight) * 2 - 1; start(); };
  if (fine) window.addEventListener('pointermove', onMove, { passive: true });
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); };
  const onRestored = () => { lost = false; try { init(); draw(performance.now()); start(); } catch { /* stays blank */ } };
  canvas.addEventListener('webglcontextlost', onLost);
  // theme switch: recolour and redraw at once (inside the view transition, before the new frame is captured)
  const themeObserver = new MutationObserver(() => {
    const next = PALETTES[themeNow()];
    if (next === C || !gl || lost) return;
    C = next;
    upload();
    draw(performance.now());
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  canvas.addEventListener('webglcontextrestored', onRestored);

  draw(performance.now());
  start();

  return {
    setProgress(p) { target = Math.max(target, Math.min(1, p)); if (!running) draw(performance.now()); },
    destroy() {
      stop();
      io?.disconnect();
      themeObserver.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
