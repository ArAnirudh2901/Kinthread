# 003 — Reduced motion: gentler, not zero
- **Status**: DONE
- **Commit**: 8437ff3
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, 1 rule

## Problem
`src/app/globals.css:139` removes every animation and every transition for `prefers-reduced-motion: reduce`:
```css
*, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
```
Reduced motion means no movement, not no feedback: opacity and colour transitions (focus, hover, the stale answer dimming) help comprehension.

## Target
```css
*, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
```
Keyframe movement (rises, sweeps, draws) stays off; transitions stay, since this site's transitions are colour, opacity and
a 3% press scale. GSAP movement already checks `prefersReducedMotion()` per component.

## Verification
macOS: System Settings > Accessibility > Display > Reduce motion. Hero text appears without rising; hovering a chip still
fades its border; editing a solved story still dims the answer over 200ms.
