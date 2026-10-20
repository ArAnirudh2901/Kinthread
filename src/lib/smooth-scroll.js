// Inertial scrolling for wheel and trackpad (Lenis, the engine behind Locomotive Scroll v5).
// Touch keeps the phone's own scroll and reduced motion keeps the browser's. Frames run only while the page is
// moving: an idle page draws nothing. Code that scrolls goes through scrollToTarget so both paths behave the same.
import Lenis from 'lenis';

let lenis = null, raf = 0, wokeAt = 0;

function loop(t) {
  lenis.raf(t);
  // Lenis marks itself scrolling on its first frame, so keep a short grace period after each input
  raf = lenis.isScrolling || t - wokeAt < 250 ? requestAnimationFrame(loop) : 0;
}
function wake() {
  wokeAt = performance.now();
  if (lenis && !raf) raf = requestAnimationFrame(loop);
}

export function startSmoothScroll() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (lenis || !fine || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  lenis = new Lenis({
    autoRaf: false,
    lerp: 0.1,
    wheelMultiplier: 0.9,
    anchors: { offset: -16 },
    allowNestedScroll: true,
    // a trackpad flick queues a lot of distance ahead of the page; reversing drops that queue so the page turns at
    // once, and the queue never runs more than most of a screen ahead
    virtualScroll: ({ deltaY }) => {
      if (!lenis || !deltaY) return true;
      const ahead = lenis.targetScroll - lenis.animatedScroll;
      if (ahead && Math.sign(deltaY) !== Math.sign(ahead)) lenis.targetScroll = lenis.animatedScroll;
      else if (Math.abs(ahead) > innerHeight * 0.8) lenis.targetScroll = lenis.animatedScroll + Math.sign(ahead) * innerHeight * 0.8;
      return true;
    },
    // dialogs, text areas and boxes that scroll on their own keep native scrolling
    prevent: (node) => !!node.closest?.('dialog, textarea, [data-scroll], [data-lenis-prevent]'),
  });
  addEventListener('wheel', wake, { passive: true });
  addEventListener('keydown', wake);
  return () => {
    removeEventListener('wheel', wake);
    removeEventListener('keydown', wake);
    cancelAnimationFrame(raf);
    raf = 0;
    lenis.destroy();
    lenis = null;
  };
}

const easeOutExpo = (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x));

/** Scroll an element into view: eased with Lenis, native smooth otherwise, instant for reduced motion. */
export function scrollToTarget(el, { offset = -16 } = {}) {
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, { offset, duration: 1.1, easing: easeOutExpo });
    wake();
    return;
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** Hold the page still behind a full-screen window (and release it after). */
export function holdScroll(held) {
  if (!lenis) return;
  if (held) lenis.stop();
  else { lenis.start(); wake(); }
}
