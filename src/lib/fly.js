import { EASE_OUT, reducedMotion, springEasing } from './motion';

// Shared-element move: a copy of `from` travels into the element `find` returns once React has drawn it, scaling
// uniformly (same text, so the type stays undistorted), and hands over to it as it lands.
export function fly(from, find) {
  if (!from?.isConnected || reducedMotion()) return;
  const a = from.getBoundingClientRect();
  requestAnimationFrame(() => {
    const to = find();
    if (!to) return;
    const b = to.getBoundingClientRect();
    const s = b.height / a.height;
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const copy = from.cloneNode(true);
    copy.removeAttribute('id');
    copy.setAttribute('aria-hidden', 'true');
    copy.tabIndex = -1;
    Object.assign(copy.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
      margin: '0', zIndex: '60', pointerEvents: 'none' });
    document.body.append(copy);
    const ms = 520;
    // position rides the spring; the hand-over is its own timing, overlapping so nothing blinks
    copy.animate({ transform: ['none', `translate(${dx}px, ${dy}px) scale(${s})`] }, { duration: ms, easing: springEasing(ms), fill: 'forwards' })
      .finished.finally(() => copy.remove());
    copy.animate({ opacity: [1, 0] }, { duration: ms * 0.3, delay: ms * 0.62, easing: EASE_OUT, fill: 'forwards' });
    to.animate({ opacity: [0, 1] }, { duration: ms * 0.3, delay: ms * 0.5, fill: 'backwards', easing: EASE_OUT });
  });
}
