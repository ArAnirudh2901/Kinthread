// The loader's progress follower against every kind of connection: download durations from 0.5 s to 10 minutes,
// display rates of 30, 60 and 120 fps, and steady, bursty (16 MB parts), jittery, stalling and slow-first-byte
// networks. Raw reports arrive every 32 ms, as the worker sends them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFollower } from '../src/lib/progress-follow.js';

function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

// raw(t) for a download that takes `total` seconds, shaped by the network pattern
function network(pattern, total, rand) {
  if (pattern === 'steady') return (t) => Math.min(1, t / total);
  // sudden spikes: a slow line (rate 1) with random bursts at 20x for 0.2 s
  if (pattern === 'spikes') {
    const seg = 0.2, n = Math.ceil(total / seg) + 2;
    const rates = Array.from({ length: n }, () => (rand() < 0.15 ? 20 : 1));
    const sum = rates.slice(0, Math.ceil(total / seg)).reduce((x, y) => x + y, 0);
    return (t) => {
      if (t >= total) return 1;
      let acc = 0, k = 0;
      for (; (k + 1) * seg <= t; k++) acc += rates[k];
      return Math.min(1, (acc + rates[k] * ((t - k * seg) / seg)) / sum);
    };
  }
  if (pattern === 'bursty') { const step = total / 4; return (t) => Math.min(1, Math.floor(t / step) * 0.26 + (t >= total ? 1 : 0)); }
  if (pattern === 'latency') { const wait = Math.min(3, total / 3); return (t) => (t < wait ? 0 : Math.min(1, (t - wait) / (total - wait))); }
  if (pattern === 'stalls') return (t) => { const cycle = total / 5, inCycle = t % cycle; const done = Math.floor(t / cycle) * 0.2 + Math.min(0.2, (inCycle / (cycle * 0.6)) * 0.2); return Math.min(1, t >= total ? 1 : done); };
  // jitter: rate varies randomly between 10% and 190% of the mean, piecewise every 0.25 s
  const rates = Array.from({ length: Math.ceil(total / 0.25) + 2 }, () => 0.1 + 1.8 * rand());
  const sum = rates.slice(0, Math.ceil(total / 0.25)).reduce((x, y) => x + y, 0);
  return (t) => {
    if (t >= total) return 1;
    let acc = 0, k = 0;
    for (; (k + 1) * 0.25 <= t; k++) acc += rates[k];
    return Math.min(1, (acc + rates[k] * ((t - k * 0.25) / 0.25)) / sum);
  };
}

function run(rawAt, seconds, fps) {
  const f = createFollower();
  const frames = [];
  let nextReport = 0;
  for (let i = 0, t = 0; t <= seconds; i++, t = i / fps) {
    while (t >= nextReport) { f.push(rawAt(nextReport)); nextReport += 0.032; }
    frames.push({ t, raw: f.raw, d: f.step(t) });
  }
  return frames;
}

const DURATIONS = [0.2, 0.5, 1, 3, 10, 60, 600];   // 0.2 s: a constant very high speed (~2.5 Gbit/s for 61 MB)
const FPS = [30, 60, 120];
const PATTERNS = ['steady', 'bursty', 'jitter', 'spikes', 'stalls', 'latency'];

for (const pattern of PATTERNS) {
  test(`${pattern}: every duration and frame rate keeps the guarantees`, () => {
    for (const total of DURATIONS) {
      for (const fps of FPS) {
        const name = `${pattern} ${total}s @${fps}fps`;
        const tail = 1 / (0.0099 * fps) + 1;   // worst case to count the rest after an instant download
        const frames = run(network(pattern, total, rng(total * 1000 + fps)), total + tail + 1, fps);
        let prev = 0, prevPct = 0;
        for (const { raw, d } of frames) {
          assert.ok(d <= raw + 1e-12, `${name}: ahead of the download`);
          assert.ok(d >= prev - 1e-12, `${name}: went backwards`);
          const pct = Math.floor(100 * d);
          assert.ok(pct - prevPct <= 1, `${name}: skipped from ${prevPct}% to ${pct}%`);
          prev = d; prevPct = pct;
        }
        const rawDone = frames.find((x) => x.raw === 1).t, done = frames.find((x) => x.d === 1)?.t;
        assert.ok(done !== undefined, `${name}: never reached 100%`);
        assert.ok(done - rawDone <= tail, `${name}: reached 100% ${done - rawDone}s after the download`);
        if (pattern === 'steady' && total >= 3 && fps >= 60) {
          const lag = Math.max(...frames.filter((x) => x.t > 1 && x.raw < 1).map((x) => x.raw - x.d));
          assert.ok(lag < 0.06, `${name}: lag ${lag}`);
          assert.ok(done - rawDone < 0.6, `${name}: finish ${done - rawDone}s late`);
        }
      }
    }
  });
}

test('bad input is safe: NaN, negatives, > 1, shrinking reports', () => {
  const f = createFollower();
  for (const r of [NaN, -1, 0.5, 0.3, 2]) f.push(r);
  for (let t = 0; t < 3; t += 1 / 60) f.step(t);
  assert.equal(f.value, 1);
});

test('a hidden tab (frames stop for 30 s) resumes without a leap', () => {
  const f = createFollower();
  f.push(0.2);
  for (let t = 0; t < 1; t += 1 / 60) f.step(t);
  const before = f.value;
  f.push(0.9);
  const after = f.step(31);   // next frame comes 30 s later
  assert.ok(after - before <= 0.0099 + 1e-9, `leapt ${after - before}`);
});
