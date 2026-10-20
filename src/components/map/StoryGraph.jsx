'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { downloadMap } from '@/lib/export-image';
import { GraphEngine } from '@/lib/graph/engine';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { fitText, resetMeasurements, textWidth } from '@/lib/measure';
import { genders, generationName } from '@/lib/relations';
import { solutionLayout } from '@/lib/solution-layout';
import { personLabel } from '@/lib/story';
import { useMotionMode } from '@/lib/useMotionMode';
import { useWidth } from '@/lib/useWidth';
import s from './StoryGraph.module.css';

// The relationship map. Live: people appear as the story is written and settle into a force layout
// (dotted lines: mentioned together, not family). Solved: a worked answer drawn like a family tree,
// built in reasoning order: the question (copper "?"), each fact from the story (numbered teal arrows),
// then the answer (lime arrow from A to B). One GSAP timeline with a stop after every step drives it;
// `player` lets the step list play, pause, step and jump.

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const NAME_MAX = 120;
const fontsReady = () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded';
function subscribeFonts(cb) {
  let live = true;
  document.fonts?.ready.then(() => { if (live) { resetMeasurements(); cb(); } });
  return () => { live = false; };
}

// pedigree notation: square male, circle female, diamond not stated
function Shape({ gender, r, className, ...rest }) {
  if (gender === 'm') return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={5} className={className} {...rest} />;
  if (gender === 'f') return <circle r={r} className={className} {...rest} />;
  const d = r * 1.25;
  return <path d={`M0 ${-d}L${d} 0L0 ${d}L${-d} 0Z`} className={className} {...rest} />;
}

export default function StoryGraph({ people, links, a, b, view, stale, onPlayer, onStep, onPick, children }) {
  const box = useRef(null);
  const svg = useRef(null);
  const width = useWidth(box);
  const mode = useMotionMode();
  const fonts = useSyncExternalStore(subscribeFonts, fontsReady, () => false);
  const engine = useRef(null);
  const stepCb = useRef(onStep);
  const playerCb = useRef(onPlayer);
  useEffect(() => { stepCb.current = onStep; playerCb.current = onPlayer; });
  const titleId = useId();
  const api = useRef(null);   // this graph's own playback controls (also handed up through onPlayer)
  const resume = useRef({ runKey: null, time: 0, playing: false });   // keep the playhead across re-layouts (resize, fonts)

  const solved = !!view && (view.variant === 'found' || view.variant === 'tentative');
  const names = useMemo(() => [...new Set([...people, ...(view?.nodes || [])].filter(Boolean))], [people, view]);

  const plan = useMemo(() => {
    const minH = !view && !names.length ? 150 : width && width < 480 ? 280 : 300;
    if (!width || !view) return { w: width, h: minH, vw: width, vh: minH };
    const count = view.variant === 'same' ? 1 : view.nodes.length;
    const words = solved ? view.edges : [];
    // no role captions: the question sentence and the copper colour already say who is asked about
    const role = () => null;
    const labels = view.nodes.slice(0, count).map((n) => fitText(personLabel(n), 'name', NAME_MAX));
    const nameW = labels.map((t, i) => Math.max(textWidth(t, 'name'), role(i) ? textWidth(role(i), 'role') : 0));
    let layout;
    if (view.variant === 'none') {
      // no family link: A and B face each other across a gap
      layout = { ...solutionLayout(width, ['brother'], nameW, [150], 150), facts: [] };
    } else if (view.variant === 'same') {
      layout = { width, natural: width, height: 170, shift: 0, pts: [{ x: width / 2, y: 70, gen: 0 }], labels: [{ x: width / 2, y: 70 + 13 + 26, anchor: 'middle' }], facts: [], answer: null, rows: [] };
    } else {
      const answerText = view.variant === 'tentative' ? `${view.relation}?` : view.relation;
      layout = solutionLayout(width, words, nameW, words.map((w) => textWidth(w, 'tag') + 46), textWidth(answerText, 'tag') + 46);
      layout.answerText = answerText;
    }
    const sexes = solved ? genders(words, view.relation) : view.nodes.map(() => null);
    // too wide for the box: shrink to at most 80%, then scroll sideways inside the frame
    const scale = layout.natural > width ? Math.max(0.8, width / layout.natural) : 1;
    return { w: layout.width, h: layout.height, vw: Math.round(layout.width * scale), vh: Math.round(layout.height * scale), layout, labels, role, sexes, count };
  }, [width, view, solved, names.length, fonts]); // eslint-disable-line react-hooks/exhaustive-deps -- fonts: re-measure once web fonts load

  useIsoLayoutEffect(() => {
    engine.current = new GraphEngine();
    return () => engine.current.destroy();
  }, []);

  const linkKey = links.map((l) => l.join('\u0000')).join('|');
  useIsoLayoutEffect(() => {
    const e = engine.current;
    if (!e || !width) return;
    e.resize(plan.w, plan.h);
    e.setGraph({ names, links, a, b, instant: mode === 'none' });
  }, [width, plan.w, plan.h, names, linkKey, a, b, mode]);

  // solved: glide the people into the tree, then play the worked answer one step at a time
  useGSAP((ctx) => {
    const e = engine.current;
    if (!e || !width) return;
    if (!view || !plan.layout) {
      resume.current = { runKey: null, time: 0, playing: false };
      api.current = null;
      playerCb.current?.(null);
      ctx.ignore(() => {
        e.setTargets(null, { instant: mode === 'none' });
        // live map: nobody may stay hidden by a previous worked answer's timeline
        gsap.set(gsap.utils.selector(svg)('[data-name] > g'), { clearProps: 'opacity,visibility,transform' });
      });
      return;
    }
    const { layout } = plan;
    const reduce = mode === 'none' || prefersReducedMotion();
    const again = resume.current.runKey === view.runKey;   // same answer re-laid out: no replay
    const targets = new Map(view.nodes.slice(0, layout.pts.length).map((n, i) => [n, { x: layout.pts[i].x, y: layout.pts[i].y + layout.shift }]));
    ctx.ignore(() => e.setTargets(targets, { instant: reduce || again, duration: 0.7 }));

    const q = gsap.utils.selector(svg);
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
    const stops = [];
    let t = reduce || again ? 0 : 0.6;   // let the people glide into place first
    const pop = { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.4)' };
    const hidden = { autoAlpha: 0, scale: 0.55, transformOrigin: '50% 50%' };

    // 0. the question: A and B, and a dashed "?" between them
    tl.set(q('[data-later]'), { autoAlpha: 0 }, 0);
    tl.set(q('[data-draw]'), { autoAlpha: 1 }, 0);
    tl.fromTo(q('[data-q-path]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6 }, t);
    tl.fromTo(q('[data-q-mark]'), hidden, pop, t + 0.4);
    t += 0.85;
    stops.push(t);
    // 1..k. one fact at a time, in the order the reasoning uses them
    (solved ? view.edges : []).forEach((_, i) => {
      t += 0.5;
      tl.fromTo(q(`[data-fact="${i}"] [data-line]`), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.55 }, t);
      tl.fromTo(q(`[data-fact="${i}"] [data-head]`), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, t + 0.5);
      tl.fromTo(q(`[data-fact="${i}"] [data-tag]`), hidden, pop, t + 0.3);
      tl.fromTo(q(`[data-reveal="${i + 1}"]`), hidden, pop, t + 0.42);
      t += 0.75;
      stops.push(t);
    });
    // last: the answer replaces the question
    t += 0.5;
    if (view.variant === 'none') {
      tl.fromTo(q('[data-stub]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.4 }, t);
      tl.fromTo(q('[data-gap]'), hidden, pop, t + 0.35);
      t += 0.9;
    } else if (layout.answer) {
      tl.to(q('[data-q]'), { autoAlpha: 0, duration: 0.35 }, t);
      tl.fromTo(q('[data-a-line]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.75 }, t + 0.1);
      tl.fromTo(q('[data-a-head]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, t + 0.8);
      tl.fromTo(q('[data-a-tag]'), hidden, { ...pop, ease: 'back.out(1.6)' }, t + 0.55);
      tl.fromTo(q('[data-lit]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, t + 0.8);
      tl.fromTo(q('[data-halo]'), { autoAlpha: 0.7, scale: 1, transformOrigin: '50% 50%' }, { autoAlpha: 0, scale: 2.3, duration: 0.8, ease: 'power2.out' }, t + 0.85);
      t += 1.2;
    } else t += 0.4;
    stops.push(t);
    tl.set({}, {}, t);   // the timeline ends exactly at the last stop

    // which step is on screen: the first stop not yet reached (at a stop, that step is complete)
    let last = -1, wasPlaying = null;
    const report = () => {
      const time = tl.time();
      let k = stops.findIndex((x) => time <= x + 1e-3);
      if (k < 0) k = stops.length - 1;
      const playing = !tl.paused() && tl.progress() < 1;   // intent, not isActive(): false until the first tick
      if (k !== last || playing !== wasPlaying) {
        last = k;
        wasPlaying = playing;
        stepCb.current?.({ step: k, steps: stops.length, playing, runKey: view.runKey });
      }
      resume.current = { runKey: view.runKey, time, playing };
    };
    tl.eventCallback('onUpdate', report);
    tl.eventCallback('onComplete', report);

    let seek = null;   // the tween that moves the playhead for Next
    const stopAt = (k) => stops[Math.max(0, Math.min(stops.length - 1, k))];
    api.current = {
        play: () => { seek?.kill(); if (tl.progress() >= 1) tl.restart(); else tl.play(); report(); },
        pause: () => { seek?.kill(); tl.pause(); report(); },
        next: () => {
          seek?.kill();
          tl.pause();
          const k = Math.max(0, last);
          const to = tl.time() >= stopAt(k) - 1e-3 ? stopAt(k + 1) : stopAt(k);   // finish this step, or go to the next
          if (reduce) tl.seek(to);
          else seek = tl.tweenTo(to, { onUpdate: report, onComplete: report });
          report();
        },
        prev: () => { seek?.kill(); tl.pause(); const k = Math.max(0, last); tl.seek(k >= 1 ? stopAt(k - 1) : 0); report(); },
        goto: (k) => { seek?.kill(); tl.pause(); tl.seek(stopAt(k)); report(); },
        replay: () => { seek?.kill(); tl.restart(); report(); },
        skip: () => { seek?.kill(); tl.pause(); tl.seek(tl.duration()); report(); },
    };
    playerCb.current?.(api.current);
    if (reduce) tl.progress(1);
    else if (again) {
      const { time, playing } = resume.current;
      tl.seek(Math.min(time, tl.duration()));
      if (playing) tl.play();   // re-laid out mid-playback (e.g. fonts finished loading): carry on
    } else tl.play();
    report();
    return () => { seek?.kill(); api.current = null; playerCb.current?.(null); };
  }, { dependencies: [view?.runKey, view?.variant, plan.layout, mode], scope: svg, revertOnUpdate: true });

  // stable ref callbacks; React 19 runs the returned cleanup when the element goes away
  const attach = useCallback((el) => {
    const name = el.dataset.name;
    engine.current?.attach(name, el);
    return () => engine.current?.attach(name, null);
  }, []);
  const attachLink = useCallback((el) => {
    const key = el.dataset.key;
    engine.current?.attachLink(key, el);
    return () => engine.current?.attachLink(key, null);
  }, []);

  // download: finish the worked answer first, then save what is on screen as a PNG
  // wide maps on narrow screens scroll sideways: fade the edge that has more to see
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const mark = () => {
      el.toggleAttribute('data-at-start', el.scrollLeft <= 1);
      el.toggleAttribute('data-at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    mark();
    el.addEventListener('scroll', mark, { passive: true });
    return () => el.removeEventListener('scroll', mark);
  }, [plan.vw, width]);

  const [save, setSave] = useState('idle');   // idle | busy | done | failed
  const download = async () => {
    if (!svg.current || save === 'busy') return;
    setSave('busy');
    api.current?.skip();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const A = view ? personLabel(view.nodes[0]) : a, B = view ? personLabel(view.nodes[view.nodes.length - 1]) : b;
    const title = solved ? `${B} is ${A}\u2019s ${view.relation}${view.variant === 'tentative' ? ' (best guess)' : ''}.`
      : view?.variant === 'none' ? `The story doesn\u2019t link ${A} and ${B} as family.`
        : view?.variant === 'same' ? `${A} was chosen twice.` : 'Story map';
    const subtitle = view ? `How is ${B} related to ${A}?  \u00b7  Worked out by Kinthread` : `${names.length} people  \u00b7  Kinthread`;
    const slug = (x) => String(x || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      await downloadMap(svg.current, { title, subtitle, legend: solved, filename: view ? `kinthread-${slug(A)}-${slug(B)}.png` : 'kinthread-story-map.png' });
      setSave('done');
    } catch {
      setSave('failed');
    }
    setTimeout(() => setSave('idle'), 2200);
  };

  const lay = plan.layout;
  const pathIndex = new Map((view?.nodes || []).slice(0, plan.count || 0).map((n, i) => [n, i]));
  const roleOf = (name) => {
    if (view) {
      const i = pathIndex.get(name);
      if (i == null) return 'out';
      if (view.variant === 'same') return 'ab';
      return i === 0 ? 'a' : i === plan.count - 1 ? 'b' : 'via';
    }
    return name === a && name === b ? 'ab' : name === a ? 'a' : name === b ? 'b' : 'person';
  };

  const desc = !view
    ? `Story map: ${names.length} ${names.length === 1 ? 'person' : 'people'}${a && b ? `; question: how is ${b} related to ${a}?` : ''}.`
    : view.variant === 'none' ? `${view.nodes[0]} and ${view.nodes[1]}: no family link found in the story.`
      : view.variant === 'same' ? `${view.nodes[0]} is selected as both people.`
        : `Worked answer: ${view.nodes.map((n, i) => (i < view.edges.length ? `${n}, ${view.edges[i]},` : n)).join(' ')}. Answer: ${view.nodes[view.nodes.length - 1]} is ${view.nodes[0]}'s ${view.relation}.`;

  return (
    <div className={s.wrap}>
      <div ref={box} className={s.box} data-stale={stale || undefined} data-view={view?.variant || 'live'} data-scroll={plan.vw > width || undefined}>
        {width > 0 && (
          <svg ref={svg} width={plan.vw || width} height={plan.vh} viewBox={`0 0 ${plan.w || width} ${plan.h}`} role="img" aria-labelledby={titleId} className={s.svg}>
            <title id={titleId}>{desc}</title>

            {!view && !names.length && (
              <g className={s.ghost} aria-hidden="true">
                <path d={`M${width * 0.22} 64H${width * 0.78}`} />
                <circle cx={width * 0.22} cy={64} r={13} /><text x={width * 0.22} y={68} textAnchor="middle">?</text>
                <circle cx={width * 0.78} cy={64} r={13} /><text x={width * 0.78} y={68} textAnchor="middle">?</text>
              </g>
            )}

            <g className={s.mentions}>
              {links.map(([p, q]) => {
                const key = `${p}\u0000${q}`;
                return <line key={key} ref={attachLink} data-key={key} className={s.mention} />;
              })}
            </g>

            {view && lay && (
              <g data-draw="" className={s.draw} transform={`translate(0 ${lay.shift})`}>
                {!lay.compact && lay.rows.length > 1 && lay.rows.map((r) => (
                  <g key={r.gen} className={s.genRow}>
                    <line x1={0} x2={plan.w} y1={r.y - lay.shift} y2={r.y - lay.shift} />
                  </g>
                ))}
                {lay.answer && (
                  <g data-q="" className={s.question}>
                    <path d={lay.answer.d} data-q-path="" className={s.qLine} />
                    <g data-q-mark="">
                      <circle cx={lay.answer.tag.cx} cy={lay.answer.tag.cy} r={13} />
                      <text x={lay.answer.tag.cx} y={lay.answer.tag.cy + 5} textAnchor="middle">?</text>
                    </g>
                  </g>
                )}
                {lay.facts.map((f, i) => (
                  <g key={i} data-fact={i} className={view.variant === 'tentative' ? `${s.fact} ${s.tentative}` : s.fact}>
                    <path d={f.d} data-line="" className={s.factLine} />
                    <path d={f.head} data-head="" className={s.factHead} />
                    <g data-tag="" className={s.factTag}>
                      <rect x={f.tag.x} y={f.tag.y} width={f.tag.w} height={f.tag.h} rx={f.tag.h / 2} />
                      <circle cx={f.tag.x + 13} cy={f.tag.cy} r={8.5} className={s.stepNum} />
                      <text x={f.tag.x + 13} y={f.tag.cy + 3.5} textAnchor="middle" className={s.stepNumText}>{i + 1}</text>
                      <text x={f.tag.x + 27 + (f.tag.w - 37) / 2} y={f.tag.cy + 4} textAnchor="middle">{view.edges[i]}</text>
                    </g>
                  </g>
                ))}
                {lay.answer && solved && (
                  <g className={view.variant === 'tentative' ? `${s.answer} ${s.tentative}` : s.answer}>
                    <path d={lay.answer.d} data-a-line="" className={s.answerBand} />
                    <path d={lay.answer.d} data-a-line="" className={s.answerLine} />
                    <path d={lay.answer.head} data-a-head="" className={s.answerHead} />
                    <g data-a-tag="" className={s.answerTag}>
                      <rect x={lay.answer.tag.x} y={lay.answer.tag.y} width={lay.answer.tag.w} height={lay.answer.tag.h} rx={lay.answer.tag.h / 2} />
                      <path d={`M${lay.answer.tag.x + 10} ${lay.answer.tag.cy}l3.5 3.5l6.5 -7`} className={s.check} />
                      <text x={lay.answer.tag.x + 25 + (lay.answer.tag.w - 35) / 2} y={lay.answer.tag.cy + 4} textAnchor="middle">{lay.answerText}</text>
                    </g>
                  </g>
                )}
                {view.variant === 'none' && <NoLink layout={lay} />}
              </g>
            )}
            {/* row names drawn over the arrows, with a halo, so an arc passing by never cuts through them */}
            {/* phones label names above/below, where row names would collide: skip them there */}
            {view && lay && !lay.compact && lay.rows.length > 1 && (
              <g className={s.genLabels} transform={`translate(0 ${lay.shift})`} aria-hidden="true">
                {lay.rows.map((r) => <text key={r.gen} x={4} y={r.y - lay.shift - 24}>{generationName(r.gen, personLabel(view.nodes[0]))}</text>)}
              </g>
            )}

            <g className={s.people}>
              {names.map((name) => {
                const role = roleOf(name);
                const i = pathIndex.get(name);
                const onPath = !!view && role !== 'out';
                const endpoint = role === 'a' || role === 'b' || role === 'ab';
                const label = onPath ? plan.labels?.[i] ?? personLabel(name) : fitText(personLabel(name), 'name', 110);
                let lx = 0, ly = endpoint ? 32 : 28, anchor = 'middle';
                if (onPath && lay?.labels?.[i] && lay.pts[i]) {
                  lx = lay.labels[i].x - lay.pts[i].x;
                  ly = lay.labels[i].y - lay.pts[i].y;
                  anchor = lay.labels[i].anchor;
                }
                const later = solved && role === 'via';
                const r = role === 'via' ? 11 : 13;
                return (
                  <g key={name} ref={attach} data-name={name} className={s.person} data-role={role} onClick={onPick && !view ? () => onPick(name) : undefined}>
                    <g data-reveal={later ? i : undefined} data-later={later ? '' : undefined}>
                      <title>{personLabel(name)}</title>
                      <circle className={s.hit} r={22} />
                      {onPath
                        ? <Shape gender={plan.sexes?.[i]} r={r} className={s.dot} />
                        : <circle className={s.dot} r={endpoint ? 13 : 7} />}
                      {/* the answer lights up the person asked about, with a check */}
                      {solved && role === 'b' && (
                        <>
                          <circle data-halo="" r={14} className={s.halo} />
                          <g data-lit="" className={s.litGroup}>
                            <Shape gender={plan.sexes?.[i]} r={r} className={s.lit} />
                            <path className={s.litCheck} d="M-4.5 0.5l3 3 6-6.5" />
                          </g>
                        </>
                      )}
                      <text className={s.name} x={lx} y={ly} textAnchor={anchor}>{label}</text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
      {/* the step caption and controls: right under the picture, before the key */}
      {children}
      <div className={s.under}>
        <Legend live={!view} links={links.length > 0} solved={solved} example={solved ? [personLabel(view.nodes[0]), view.edges[0], personLabel(view.nodes[1])] : null} />
        {(view || names.length > 0) && (
          <button type="button" className={s.download} onClick={download} data-state={save} aria-label="Download the map as an image" title="Download the map as a PNG image">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              {save === 'done'
                ? <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                : <><path className={s.dlArrow} d="M8 2.5v7.5M4.8 7.2 8 10.4l3.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>}
            </svg>
            <span>{save === 'done' ? 'Saved' : save === 'failed' ? 'Try again' : 'Download'}</span>
          </button>
        )}
      </div>
      <span className="visually-hidden" aria-live="polite">{save === 'done' ? 'Image downloaded.' : save === 'failed' ? 'The image could not be saved.' : ''}</span>
    </div>
  );
}

function Legend({ live, links, solved, example }) {
  if (live) {
    return links ? <p className={s.legend}><span className={s.keyMention} aria-hidden="true" /> mentioned together in the story, not a family link</p> : null;
  }
  if (!solved) return null;
  return (
    <div className={s.legendBlock}>
      <ul className={s.keys} aria-label="How to read the map">
        <li><span className={s.keyQuestion} aria-hidden="true" />the question</li>
        <li><span className={s.keyFact} aria-hidden="true" />a fact from the story</li>
        <li><span className={s.keyAnswer} aria-hidden="true" />the answer</li>
        <li><span className={s.keyShapes} aria-hidden="true"><i className={s.sq} /><i className={s.ci} /><i className={s.di} /></span>male, female, not stated</li>
      </ul>
      {example && (
        <p className={s.readHint}>
          An arrow points from a person to their relative: <b>{example[0]} &rarr; {example[1]} &rarr; {example[2]}</b> means {example[2]} is {example[0]}&rsquo;s {example[1]}.
        </p>
      )}
    </div>
  );
}

function NoLink({ layout }) {
  const p = layout.pts[0], q = layout.pts[layout.pts.length - 1];
  if (!q || p === q) return null;
  const mid = { x: (p.x + q.x) / 2, y: p.y };
  const text = 'no family link';
  const w = textWidth(text.toUpperCase(), 'tag') + 22;
  return (
    <>
      <path d={`M${p.x + 18} ${p.y}H${p.x + (q.x - p.x) * 0.32}`} data-stub="" className={s.stub} />
      <path d={`M${q.x - 18} ${q.y}H${q.x - (q.x - p.x) * 0.32}`} data-stub="" className={s.stub} />
      <g data-gap="" className={s.gap}>
        <rect x={mid.x - w / 2} y={mid.y - 12} width={w} height={24} rx={12} />
        <text x={mid.x} y={mid.y + 4} textAnchor="middle">{text}</text>
      </g>
    </>
  );
}
