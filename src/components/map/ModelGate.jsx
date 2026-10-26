'use client';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { holdScroll } from '@/lib/smooth-scroll';
import Mark from '@/components/brand/Mark';
import { retryModel, startModel } from '@/lib/model/client';
import { gateStore, setGateOpen } from '@/lib/model/gate';
import { EASE_OUT, reducedMotion, springEasing } from '@/lib/motion';
import { useFollowedProgress } from '@/lib/useFollowedProgress';
import { useModel } from '@/lib/model/useModel';
import { AskCopy, DownloadStatus, WeaveStage, downloadPct, weaveStyles as w } from './Weave';
import s from './ModelGate.module.css';

const OPEN_MS = 760, CLOSE_MS = 560;

// Where a control sits and how it looks, so the window can start (and end) as exactly that shape.
function shapeOf(el) {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return null;
  const cs = getComputedStyle(el);
  const radius = Math.min(r.height / 2, parseFloat(cs.borderTopLeftRadius) || 0);
  const bg = cs.backgroundColor;
  const color = /rgba?\(.*,\s*0\)$|transparent/.test(bg) ? getComputedStyle(document.documentElement).getPropertyValue('--surface-2') : bg;
  return { r, color, el, clip: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${radius}px)` };
}

// One shape, never cut: the window's outline morphs between the control and the screen (clip-path, a spring), its
// colour cross-fades from the control's, the control's label blurs out and the download view blurs in.
function morph({ dialog, skin, ghost, body }, dir, shape) {
  const all = [];
  if (reducedMotion() || !shape) {
    all.push(dialog.animate({ opacity: dir === 'in' ? [0, 1] : [1, 0] }, { duration: 220, easing: EASE_OUT, fill: 'forwards' }));
    return Promise.all(all.map((a) => a.finished)).catch(() => {});
  }
  const ms = dir === 'in' ? OPEN_MS : CLOSE_MS, full = 'inset(0px 0px 0px 0px round 0px)';
  // the control's look, drawn where it was: a copy of it with its own fill removed
  ghost.replaceChildren();
  const copy = shape.el.cloneNode(true);
  copy.removeAttribute('id');
  copy.setAttribute('aria-hidden', 'true');
  Object.assign(copy.style, { position: 'absolute', left: `${shape.r.left}px`, top: `${shape.r.top}px`, width: `${shape.r.width}px`,
    height: `${shape.r.height}px`, margin: '0', transform: 'none', background: 'transparent', borderColor: 'transparent', boxShadow: 'none' });
  ghost.append(copy);
  skin.style.background = shape.color;
  const opts = (o) => ({ fill: 'both', easing: EASE_OUT, ...o });
  if (dir === 'in') {
    all.push(dialog.animate({ clipPath: [shape.clip, full] }, { duration: ms, easing: springEasing(ms), fill: 'both' }));
    all.push(skin.animate({ opacity: [1, 0] }, opts({ duration: ms * 0.5, delay: ms * 0.08 })));
    all.push(ghost.animate({ opacity: [1, 0], filter: ['blur(0px)', 'blur(6px)'] }, opts({ duration: 200 })));
    all.push(body.animate({ opacity: [0, 1], filter: ['blur(10px)', 'blur(0px)'], transform: ['scale(0.97)', 'none'] }, opts({ duration: ms * 0.7, delay: ms * 0.28 })));
  } else {
    all.push(body.animate({ opacity: [1, 0], filter: ['blur(0px)', 'blur(8px)'], transform: ['none', 'scale(0.98)'] }, opts({ duration: 180 })));
    all.push(dialog.animate({ clipPath: [full, shape.clip] }, { duration: ms, easing: springEasing(ms), fill: 'both', delay: 60 }));
    all.push(skin.animate({ opacity: [0, 1] }, opts({ duration: ms * 0.45, delay: ms * 0.4 })));
    all.push(ghost.animate({ opacity: [0, 1], filter: ['blur(6px)', 'blur(0px)'] }, opts({ duration: 220, delay: ms * 0.62 })));
  }
  return Promise.all(all.map((a) => a.finished)).catch(() => {});
}

// The model window. It opens only when something asks for the model (Solve, an example, Download) and grows out of
// that control; once the model is ready and the weave complete, it shrinks back into the control.
export default function ModelGate() {
  const model = useModel();
  const req = useSyncExternalStore(gateStore.subscribe, gateStore.request, gateStore.serverRequest);
  const [closedId, setClosedId] = useState(0);
  const [wovenId, setWovenId] = useState(null);
  const dialog = useRef(null), skin = useRef(null), ghost = useRef(null), body = useRef(null);
  const closing = useRef(false);
  const open = !!req && req.id !== closedId;
  const woven = wovenId === req?.id;
  const parts = () => ({ dialog: dialog.current, skin: skin.current, ghost: ghost.current, body: body.current });

  useLayoutEffect(() => {
    const d = dialog.current;
    if (!open || !d || d.open) return;
    d.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    body.current?.focus({ preventScroll: true });   // the window, not its first button: no stray focus ring
    setGateOpen(true);
    holdScroll(true);
    morph(parts(), 'in', shapeOf(req.from));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = async () => {
    const d = dialog.current;
    if (closing.current || !open || !d) return;
    closing.current = true;
    await morph(parts(), 'out', shapeOf(req.from) || shapeOf(document.querySelector('[data-solve]')));
    if (d.close) d.close(); else d.removeAttribute('open');
    d.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    closing.current = false;
    holdScroll(false);
    setGateOpen(false);
    setClosedId(req.id);
    req.then?.();
  };

  const busy = model.status === 'starting' || model.status === 'loading';
  const ready = model.status === 'ready';
  useEffect(() => {
    if (!open || !ready || !woven) return;   // close only once the weave is complete and "Ready" has been seen
    const t = setTimeout(close, 1100);
    return () => clearTimeout(t);
  }, [open, ready, woven]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = ready && woven ? 'ready' : model.status === 'error' ? 'error' : busy || ready ? 'busy' : 'ask';   // ready but still weaving: keep counting
  // one value drives the weave and the number: the download, followed smoothly (never ahead, never backwards)
  const progress = useFollowedProgress(ready ? 1 : busy ? downloadPct(model) / 100 : 0, req?.id || 0);

  return (
    <dialog ref={dialog} className={s.gate} data-state={state} aria-labelledby="gate-title" onCancel={(e) => { e.preventDefault(); close(); }}>
      <div ref={skin} className={s.skin} aria-hidden="true" />
      <div ref={ghost} className={s.ghost} aria-hidden="true" />
      <div ref={body} className={s.body} tabIndex={-1}>
        <div className={s.brand}><Mark size={26} /><span id="gate-title">Kinthread</span></div>
        {open && (
          <WeaveStage key={req.id} progress={progress} onWoven={() => setWovenId(req.id)}>
            {state === 'ask' && <AskCopy total={model.total} onStart={() => startModel()} onLater={close} />}
            {(state === 'busy' || state === 'ready') && <DownloadStatus model={model} shown={progress} onHide={close} woven={woven} />}
            {state === 'error' && (
              <>
                <h2 className={w.title}>The model couldn&rsquo;t load.</h2>
                <p className={w.text}>{model.error?.message || 'Check the connection and try again.'}</p>
                <div className={w.actions}>
                  <button type="button" className={w.primary} onClick={() => retryModel({ update: !!req?.update })}>
                    {model.error?.code === 'release-check' ? 'Download latest model' : 'Try again'}
                  </button>
                  <button type="button" className={w.quiet} onClick={close}>Close</button>
                </div>
              </>
            )}
          </WeaveStage>
        )}
      </div>
    </dialog>
  );
}
