// The loader's progress follower against simulated downloads: steady, bursty (16 MB parts), stalled, and a last-chunk
// jump. Frames at 60 fps; raw reports every 32 ms, as the worker sends them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFollower } from '../src/lib/progress-follow.js';

function run(rawAt, seconds) {
  const f = createFollower();
  const frames = [];
  let nextReport = 0;
  for (let t = 0; t <= seconds; t += 1 / 60) {
    if (t >= nextReport) { f.push(rawAt(t)); nextReport += 0.032; }
    frames.push({ t, raw: f.raw, d: f.step(t) });
  }
  return frames;
}

function checkInvariants(frames, name) {
  let prev = 0;
  for (const { raw, d } of frames) {
    assert.ok(d <= raw + 1e-12, `${name}: ahead of the download (${d} > ${raw})`);
    assert.ok(d >= prev - 1e-12, `${name}: went backwards (${prev} -> ${d})`);
    prev = d;
  }
}

const maxStep = (frames) => Math.max(...frames.slice(1).map((x, i) => x.d - frames[i].d));
const doneAt = (frames) => frames.find((x) => x.d === 1)?.t;
const rawDoneAt = (frames) => frames.find((x) => x.raw === 1)?.t;

test('steady download: tracks closely, every percent shown in order, exact 100%', () => {
  const frames = run((t) => Math.min(1, t / 3), 4);   // whole model in 3 s (a fast connection)
  checkInvariants(frames, 'steady');
  const lag = Math.max(...frames.filter((x) => x.t > 0.5 && x.raw < 1).map((x) => x.raw - x.d));
  assert.ok(lag < 0.06, `lag ${lag}`);
  assert.ok(maxStep(frames) < 0.015, `largest frame step ${maxStep(frames)}`);
  const pcts = [...new Set(frames.map((x) => Math.floor(100 * x.d)))];
  assert.ok(pcts.every((p, i) => i === 0 || p - pcts[i - 1] <= 1), 'a percentage was skipped');
  assert.equal(frames.at(-1).d, 1);
  assert.ok(doneAt(frames) - rawDoneAt(frames) < 0.6, `100% came ${doneAt(frames) - rawDoneAt(frames)} s after the download`);
});

test('bursty download (16 MB parts): no jumps, never ahead', () => {
  const frames = run((t) => Math.min(1, Math.floor(t / 0.8) * 0.27), 5);   // 27% lands every 0.8 s
  checkInvariants(frames, 'bursty');
  assert.ok(maxStep(frames) < 0.06, `largest frame step ${maxStep(frames)}`);
  assert.equal(frames.at(-1).d, 1);
});

test('stalled download: holds still, never creeps past the data', () => {
  const frames = run((t) => (t < 1 ? t * 0.4 : 0.4), 4);
  checkInvariants(frames, 'stall');
  assert.equal(frames.at(-1).d, 0.4);
  assert.ok(frames.filter((x) => x.t > 2).every((x) => x.d === 0.4));
});

test('last chunk jump: rises smoothly to exactly 100%', () => {
  const frames = run((t) => (t < 1 ? 0.97 * t : 1), 3);
  checkInvariants(frames, 'last');
  assert.ok(maxStep(frames) < 0.03);
  assert.equal(frames.at(-1).d, 1);
  assert.ok(doneAt(frames) - rawDoneAt(frames) < 0.6);
});

test('bad input is safe: NaN, negatives, > 1, shrinking reports', () => {
  const f = createFollower();
  for (const r of [NaN, -1, 0.5, 0.3, 2]) f.push(r);
  for (let t = 0; t < 2; t += 1 / 60) f.step(t);
  assert.equal(f.value, 1);
});
