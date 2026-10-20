import { reducedMotion } from './motion';

// A bar that slides between items like liquid: each edge rides its own spring, and the edge leading the move is
// stiffer, so the bar stretches toward where it is going and the trailing edge catches up. Transform only; frames run
// only while it moves.
export function liquidBar(container, bar) {
  let L = null, R = null, vL = 0, vR = 0, tL = 0, tR = 0, raf = 0, last = 0;
  const BASE = 100;   // the bar's CSS width; scaleX stretches it to the target
  const draw = () => { bar.style.transform = `translateX(${L.toFixed(2)}px) scaleX(${((R - L) / BASE).toFixed(4)})`; };
  const step = (t) => {
    const dt = last ? Math.min(0.032, (t - last) / 1000) : 1 / 60;
    last = t;
    const dir = Math.sign(tL + tR - (L + R));
    const lead = 640, trail = 260, damp = (k) => 2 * Math.sqrt(k) * 0.86;
    const kL = dir < 0 ? lead : trail, kR = dir > 0 ? lead : trail;
    vL += (-kL * (L - tL) - damp(kL) * vL) * dt; L += vL * dt;
    vR += (-kR * (R - tR) - damp(kR) * vR) * dt; R += vR * dt;
    draw();
    if (Math.abs(L - tL) + Math.abs(R - tR) + Math.abs(vL) + Math.abs(vR) > 0.05) raf = requestAnimationFrame(step);
    else { L = tL; R = tR; draw(); raf = 0; last = 0; }
  };
  return {
    to(el, { instant = false } = {}) {
      if (!el) { bar.style.opacity = '0'; return; }
      const c = container.getBoundingClientRect(), r = el.getBoundingClientRect();
      tL = r.left - c.left; tR = r.right - c.left;
      bar.style.opacity = '1';
      if (L == null || instant || reducedMotion()) { L = tL; R = tR; vL = vR = 0; draw(); return; }
      if (!raf) raf = requestAnimationFrame(step);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
