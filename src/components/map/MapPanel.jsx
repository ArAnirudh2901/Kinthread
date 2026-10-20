'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { splitQuestion } from '@/lib/exam';
import { buildPath, mentionLinks } from '@/lib/story';
import ModelError from './ModelError';
import ModelLoading from './ModelLoading';
import ResultView, { Headline } from './ResultView';
import rs from './results.module.css';
import StepCaption from './StepCaption';
import StoryGraph from './StoryGraph';
import ErrorBoundary from '@/components/ErrorBoundary';
import TraceError from './TraceError';
import s from './MapPanel.module.css';

/** What the graph should draw for a finished trace, or null to stay live. */
function graphView(run) {
  const r = run.result;
  if (r.kind === 'answer' || r.kind === 'not sure') {
    const p = buildPath(run.a, run.b, r.steps);
    return p.linked ? { variant: r.kind === 'answer' ? 'found' : 'tentative', nodes: p.nodes, edges: p.edges, relation: r.relation, runKey: run.id } : null;
  }
  if (r.kind === 'unknown') return { variant: 'none', nodes: [run.a, run.b], edges: [], runKey: run.id };
  if (r.kind === 'same') return { variant: 'same', nodes: [run.a], edges: [], runKey: run.id };
  return null;
}

// Copy below the map enters with a short 3D unfold whenever it changes.
function Unfold({ id, children }) {
  const el = useRef(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(el.current, { autoAlpha: 0, y: 14, rotationX: -12, transformPerspective: 900, transformOrigin: '50% 0%' },
      { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.55, ease: 'expo.out', clearProps: 'transform' });
  }, { dependencies: [id], scope: el });
  return <div ref={el} className={s.body}>{children}</div>;
}

export default function MapPanel({ model, state, words, maxTokens, onRetryTrace, onEditStory, onChoose, onPick }) {
  const { run, last, a, b, story, people, detected } = state;
  const running = run?.status === 'running';
  const shown = run?.status === 'done' ? run : running ? last : null;
  const stale = !!shown && !running && (shown.story !== story || shown.a !== a || shown.b !== b);
  // an edited story keeps its last answer on screen (dimmed, no replay) until it is solved again
  const view = useMemo(() => (shown ? graphView(shown) : null), [shown]);
  const [drawn, setDrawn] = useState(null);
  // the worked answer's playhead: which step is showing, and controls for the step list
  const player = useRef(null);
  const onPlayer = useCallback((api) => { player.current = api; }, []);
  const [progress, setProgress] = useState(null);
  const onStep = useCallback((st) => { setProgress(st); if (st.step === st.steps - 1) setDrawn(st.runKey); }, []);
  const links = useMemo(() => (detected === story ? mentionLinks(splitQuestion(story).story, people) : []), [detected, story, people]);
  const ready = model.status === 'ready';

  let key, body;
  if (run?.status === 'error') { key = `trace-error-${run.id}`; body = <TraceError error={run.error} onRetry={onRetryTrace} />; }
  else if (shown) {
    key = `result-${shown.id}`;
    body = (
      <ResultView run={shown} stale={stale} words={words} maxTokens={maxTokens} info={model.info}
        shown={drawn === shown.id || !graphView(shown)}
        progress={progress?.runKey === shown.id && !stale ? progress : null}
        player={player}
        onRetry={onRetryTrace} onEditStory={onEditStory} onChoose={onChoose} />
    );
  } else {
    key = 'idle';
    const text = !story.trim()
      ? 'Write a story or try an example. Everyone in it appears here as you type.'
      : !a || !b ? 'Pick two people. The answer appears here, worked out step by step.'
        : 'Press Solve to see how they are related.';
    body = <p className={s.idle}>{text}</p>;
  }

  return (
    <section className={s.panel} aria-labelledby="map-title">
      <div className={s.head}>
        <h2 id="map-title" className="step"><span className="step-num" aria-hidden="true">3</span>See how they&rsquo;re related</h2>
      </div>
      <div className={s.sheet} data-sheet="" aria-busy={running || undefined}>
        {model.status === 'error' ? <ModelError error={model.error} />
          : !ready ? <ModelLoading model={model} />
            : (
              <>
                {view && (view.variant === 'found' || view.variant === 'tentative') && (
                  <div className={`${rs.result} ${stale ? s.staleDim : ''}`}><Headline run={shown} shown={drawn === shown.id} tentative={view.variant === 'tentative'} /></div>
                )}
                <ErrorBoundary resetKey={shown?.id ?? story} fallback={<p className={s.idle}>The map couldn&rsquo;t be drawn for this story. The answer and its steps are below.</p>}>
                <StoryGraph people={people} links={links} a={a} b={b} view={view} stale={stale} share={shown ? { story: shown.story, a: shown.a, b: shown.b } : null} onPlayer={onPlayer} onStep={onStep} onPick={onPick}>
                  {view && !stale && (view.variant === 'found' || view.variant === 'tentative') && (
                    <StepCaption run={shown} tentative={view.variant === 'tentative'} progress={progress?.runKey === shown.id ? progress : null} player={player} />
                  )}
                </StoryGraph>
                </ErrorBoundary>
                <Unfold id={key}>{body}</Unfold>
              </>
            )}
        <span className={s.tracing} aria-hidden="true">Solving…</span>
      </div>
      <p className={s.privacy}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
        <span><strong>Private.</strong> Your story never leaves this device, and there is no account to make.</span>
      </p>
    </section>
  );
}
