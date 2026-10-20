// Live layout for the story graph. A single GSAP ticker callback per frame runs a small force-directed
// simulation (Fruchterman-Reingold: links pull to a rest length, everyone repels, gravity keeps the
// graph centred) for people being found, lets GSAP tweens glide people into the answer layout, then
// writes every SVG attribute in one batch (no reads in the loop, no React renders). Integration is
// scaled by the frame's real duration, so 60 Hz and 120 Hz screens move identically. The callback is
// removed from the ticker as soon as nothing moves.
import { gsap } from '../gsap.js';

const PAD_X = 40;
const PAD_TOP = 30;
const PAD_BOTTOM = 46;      // names sit under the dots
const STRENGTH = 0.014;
const DAMPING = 0.76;
const MAX_SPEED = 7;         // px per 60 Hz frame: motion glides, never jumps
const WIDE = 1.7;            // names sit under dots, so neighbours need more room side by side

// seeded randomness: the same story always lays out the same way
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GraphEngine {
  constructor() {
    this.nodes = new Map();   // name -> { x, y, vx, vy, alpha, ta, scale, held, el, anchor }
    this.links = new Map();   // key -> { a, b, el, alpha, ta }
    this.els = new Map();
    this.linkEls = new Map();
    this.w = 0;
    this.h = 0;
    this.awake = false;
    this.instant = false;
    this.random = rng(7);
    this.tick = this.tick.bind(this);
  }

  attach(name, el) {
    if (el) this.els.set(name, el); else this.els.delete(name);
    const n = this.nodes.get(name);
    if (n && el) { n.el = el; this.writeNode(n); }
  }

  attachLink(key, el) {
    if (el) this.linkEls.set(key, el); else this.linkEls.delete(key);
    const l = this.links.get(key);
    if (l && el) { l.el = el; this.writeLink(l); }
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const sx = this.w ? w / this.w : 1, sy = this.h ? h / this.h : 1;
    for (const n of this.nodes.values()) if (!n.held) { n.x *= sx; n.y *= sy; }
    this.w = w;
    this.h = h;
    this.wake();
  }

  /** People and text links; a and b are pulled gently toward the left and right edges. */
  setGraph({ names, links, a, b, instant = false }) {
    this.instant = instant;
    const keep = new Set(names);
    for (const name of this.nodes.keys()) if (!keep.has(name)) this.nodes.delete(name);
    const adj = new Map();
    for (const [p, q] of links) {
      (adj.get(p) || adj.set(p, []).get(p)).push(q);
      (adj.get(q) || adj.set(q, []).get(q)).push(p);
    }
    for (const name of names) {
      let n = this.nodes.get(name);
      if (!n) {
        // a new person appears next to someone they are mentioned with, else near the middle
        const friend = (adj.get(name) || []).map((x) => this.nodes.get(x)).find(Boolean);
        const ox = friend ? friend.x : this.w / 2, oy = friend ? friend.y : this.h / 2;
        const ang = this.random() * Math.PI * 2;
        n = { x: ox + Math.cos(ang) * 26, y: oy + Math.sin(ang) * 26, vx: 0, vy: 0, alpha: 0, ta: 1, scale: 0.55, held: false, el: this.els.get(name) };
        this.nodes.set(name, n);
      }
      n.anchor = name === a && name !== b ? -1 : name === b && name !== a ? 1 : 0;
    }
    const wanted = new Set();
    for (const [p, q] of links) {
      const key = `${p}\u0000${q}`;
      wanted.add(key);
      if (!this.links.has(key)) this.links.set(key, { a: p, b: q, el: this.linkEls.get(key), alpha: 0, ta: 1 });
    }
    for (const key of this.links.keys()) if (!wanted.has(key)) this.links.delete(key);
    if (instant) this.settleNow(); else this.wake();
  }

  /** Answer layout: targets is a Map name -> {x, y}; everyone else fades out. null returns to live layout. */
  setTargets(targets, { instant = false, duration = 0.75 } = {}) {
    for (const [name, n] of this.nodes) {
      const t = targets?.get(name);
      gsap.killTweensOf(n);
      if (t) {
        n.held = true;
        n.ta = 1;
        n.vx = n.vy = 0;
        if (instant) { n.x = t.x; n.y = t.y; n.alpha = 1; n.scale = 1; }
        else gsap.to(n, { x: t.x, y: t.y, scale: 1, duration, ease: 'expo.out' });
      } else {
        n.held = false;
        n.ta = targets ? 0 : 1;
      }
    }
    for (const l of this.links.values()) l.ta = targets ? 0 : 1;
    if (instant) { this.settleNow(); } else this.wake();
  }

  wake() {
    if (this.awake || !this.w) return;
    this.awake = true;
    gsap.ticker.add(this.tick);
  }

  sleep() {
    if (!this.awake) return;
    this.awake = false;
    gsap.ticker.remove(this.tick);
  }

  destroy() {
    this.sleep();
    for (const n of this.nodes.values()) gsap.killTweensOf(n);
  }

  // reduced motion: run the simulation to rest at once, then draw a single frame
  settleNow() {
    if (!this.w) return;
    for (let i = 0; i < 400 && this.step(1) > 0.02; i++);
    for (const n of this.nodes.values()) { n.alpha = n.ta; n.scale = 1; }
    for (const l of this.links.values()) l.alpha = l.ta;
    this.write();
  }

  tick(_time, deltaTime) {
    const f = Math.min(3, Math.max(0.25, deltaTime / 16.667));
    let motion = this.step(f);
    for (const n of this.nodes.values()) {
      const k = 1 - Math.pow(0.8, f);
      n.alpha += (n.ta - n.alpha) * k;
      if (!n.held) n.scale += (1 - n.scale) * k;
      motion = Math.max(motion, Math.abs(n.ta - n.alpha), Math.abs(1 - n.scale), n.held && gsap.isTweening(n) ? 1 : 0);
    }
    for (const l of this.links.values()) {
      l.alpha += (l.ta - l.alpha) * (1 - Math.pow(0.8, f));
      motion = Math.max(motion, Math.abs(l.ta - l.alpha));
    }
    this.write();
    if (motion < 0.015) this.sleep();
  }

  /** One physics step for the people not held by a tween; returns the largest speed. */
  step(f) {
    const free = [...this.nodes.values()];
    const n = free.length;
    if (!n) return 0;
    const w = this.w, h = this.h;
    const L = Math.min(118, Math.max(44, Math.sqrt((w * h) / n) * 0.5));
    const cx = w / 2, cy = (PAD_TOP + h - PAD_BOTTOM) / 2;
    const fx = new Float64Array(n), fy = new Float64Array(n);
    for (let i = 0; i < n; i++) {   // gravity first: the pair loop below adds to both ends
      const p = free[i];
      fx[i] = (cx + p.anchor * w * 0.3 - p.x) * (p.anchor ? 0.05 : 0.012);
      fy[i] = (cy - p.y) * 0.035;
    }
    for (let i = 0; i < n; i++) {
      const p = free[i];
      for (let j = i + 1; j < n; j++) {
        const q = free[j];
        let dx = p.x - q.x, dy = p.y - q.y;
        if (dx === 0 && dy === 0) { dx = this.random() - 0.5; dy = this.random() - 0.5; }
        // measured in a space where horizontal distance counts less, so side-by-side names push apart harder
        const ex = dx / WIDE;
        const d2 = ex * ex + dy * dy;
        const rep = (STRENGTH * L * L) / d2;      // L^2/d along the unit vector
        fx[i] += dx * rep; fy[i] += dy * rep;
        fx[j] -= dx * rep; fy[j] -= dy * rep;
      }
    }
    const index = new Map(free.map((p, i) => [p, i]));
    for (const l of this.links.values()) {
      const p = this.nodes.get(l.a), q = this.nodes.get(l.b);
      if (!p || !q) continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const att = (STRENGTH * d) / L;             // d^2/L along the unit vector
      const i = index.get(p), j = index.get(q);
      fx[i] += dx * att; fy[i] += dy * att;
      fx[j] -= dx * att; fy[j] -= dy * att;
    }
    let maxV = 0;
    const damp = Math.pow(DAMPING, f);
    for (let i = 0; i < n; i++) {
      const p = free[i];
      if (p.held) continue;
      p.vx = (p.vx + fx[i] * f) * damp;
      p.vy = (p.vy + fy[i] * f) * damp;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > MAX_SPEED) { p.vx *= MAX_SPEED / sp; p.vy *= MAX_SPEED / sp; }
      const x = p.x + p.vx * f, y = p.y + p.vy * f;
      p.x = Math.min(w - PAD_X, Math.max(PAD_X, x));
      p.y = Math.min(h - PAD_BOTTOM, Math.max(PAD_TOP, y));
      if (p.x !== x) p.vx = 0;   // resting against a wall: no momentum into it
      if (p.y !== y) p.vy = 0;
      maxV = Math.max(maxV, Math.abs(p.vx), Math.abs(p.vy));
    }
    return maxV;
  }

  write() {
    for (const n of this.nodes.values()) this.writeNode(n);
    for (const l of this.links.values()) this.writeLink(l);
  }

  writeNode(n) {
    if (!n.el) return;
    const s = n.scale > 0.999 ? '' : ` scale(${n.scale.toFixed(3)})`;
    n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})${s}`);
    n.el.style.opacity = n.alpha.toFixed(3);
  }

  writeLink(l) {
    if (!l.el) return;
    const p = this.nodes.get(l.a), q = this.nodes.get(l.b);
    if (!p || !q) return;
    l.el.setAttribute('x1', p.x.toFixed(1));
    l.el.setAttribute('y1', p.y.toFixed(1));
    l.el.setAttribute('x2', q.x.toFixed(1));
    l.el.setAttribute('y2', q.y.toFixed(1));
    l.el.style.opacity = (l.alpha * Math.min(p.alpha, q.alpha)).toFixed(3);
  }
}
