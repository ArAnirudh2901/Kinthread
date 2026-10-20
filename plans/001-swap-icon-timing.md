# 001 — Swap icon: drop the bounce, fit the UI budget
- **Status**: DONE
- **Commit**: 8437ff3
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1 line

## Problem
`src/components/workbench/PeoplePicker.jsx:33` turns the swap arrows half a turn with overshoot:
```js
gsap.to(icon, { rotation: to, duration: 0.55, ease: 'back.out(1.8)', transformOrigin: '50% 50%', overwrite: true });
```
550ms is past the 300ms UI budget, and the bounce has no momentum behind it (a click, not a flick).

## Target
```js
gsap.to(icon, { rotation: to, duration: 0.28, ease: 'power3.out', transformOrigin: '50% 50%', overwrite: true });
```
Keep the rounding to multiples of 180° and `overwrite: true` (interruptible mid-turn).

## Verification
Click swap five times quickly: the arrows always land upright, never overshoot, and keep up with every click.
