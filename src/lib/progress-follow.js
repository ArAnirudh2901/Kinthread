// One displayed progress value for the loader, followed from the raw download fraction (bytes / total, reported
// ~every 32 ms). The weave (threads = d x all threads) and the percentage (floor(100 d)) both read this same value, so
// they always agree. Guarantees, checked in tests/progress-follow.test.mjs:
//   never ahead of the download (d <= raw), never backwards, smooth (critically damped: no jumps even when data
//   arrives in bursts), at most MAX_STEP per frame (so no percentage is ever skipped, at any connection speed or frame
//   rate), and settles exactly on raw, so it reads 100% only once the download is complete.
const MAX_STEP = 0.0099;   // just under 1% per frame
export function createFollower({ smoothTime = 0.12 } = {}) {
  let value = 0, vel = 0, raw = 0, last = null;
  return {
    /** New raw fraction from the download (ignored if lower: downloads only grow). */
    push(r) {
      const x = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
      if (x > raw) raw = x;
    },
    /** Advance to time t (seconds) and return the displayed value. */
    step(t) {
      const dt = last == null ? 0 : Math.min(0.1, Math.max(0, t - last));   // a hidden tab must not cause a leap
      last = t;
      if (dt === 0 || value === raw) return value;
      // SmoothDamp (Game Programming Gems 4): a critically damped spring toward raw
      const omega = 2 / smoothTime, x = omega * dt;
      const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const change = value - raw, temp = (vel + omega * change) * dt;
      vel = (vel - omega * temp) * decay;
      let next = raw + (change + temp) * decay;
      if (next > raw) { next = raw; vel = 0; }   // never ahead of the download
      if (next - value > MAX_STEP) { next = value + MAX_STEP; vel = Math.min(vel, MAX_STEP / dt); }   // every percent shown
      if (next < value) { next = value; vel = Math.max(0, vel); }   // never backwards
      if (raw - next < 1e-4) { next = raw; vel = 0; }   // settle exactly (100% is reached, not approached forever)
      value = next;
      return value;
    },
    get value() { return value; },
    get raw() { return raw; },
    /** Still moving toward raw. */
    get moving() { return value !== raw; },
  };
}
