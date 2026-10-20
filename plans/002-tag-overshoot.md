# 002 — Map tags: a settle, not a pop
- **Status**: DONE
- **Commit**: 8437ff3
- **Severity**: LOW
- **Category**: Cohesion
- **Estimated scope**: 1 file, 2 values

## Problem
`src/components/map/StoryGraph.jsx:118` and `:148` reveal step tags and the answer tag with strong overshoot:
```js
const pop = { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)' };
tl.fromTo(q('[data-a-tag]'), hidden, { ...pop, ease: 'back.out(2.6)' }, t + 0.55);
```
On a diagram students read, a 20–30% overshoot reads as a toy. A small settle keeps the moment without the bounce.

## Target
```js
const pop = { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.4)' };
tl.fromTo(q('[data-a-tag]'), hidden, { ...pop, ease: 'back.out(1.6)' }, t + 0.55);
```
`hidden` stays `scale: 0.55` + `autoAlpha: 0` (never `scale(0)`).

## Verification
Play a three-step example at 0.25× (GSAP `tl.timeScale(0.25)` in the console): tags grow in and settle with a barely visible overshoot.
