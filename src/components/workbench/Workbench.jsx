'use client';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { askBeforeDownload, askModel, detectPeople, startModel } from '@/lib/model/client';
import { useModel } from '@/lib/model/useModel';
import { announce } from '@/lib/kinds';
import { EXAMPLES } from '@/lib/examples';
import { prepare, splitQuestion } from '@/lib/exam';
import { MAX_PEOPLE, WORD_LIMIT, countWords } from '@/lib/story';
import MapPanel from '@/components/map/MapPanel';
import DevData from './DevData';
import Examples from './Examples';
import PeoplePicker from './PeoplePicker';
import StoryEditor from './StoryEditor';
import TraceBar from './TraceBar';
import { initialState, reducer } from './state';
import s from './Workbench.module.css';

const DRAFT = 'kinthread-draft';

export default function Workbench() {
  const model = useModel();
  const [st, dispatch] = useReducer(reducer, initialState);
  const detectSeq = useRef(0);
  const runSeq = useRef(0);
  const editorRef = useRef(null);
  const pickerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => { if (!askBeforeDownload()) startModel(); }, []);

  // the hero's "Try an example" button
  useEffect(() => {
    const onExample = (e) => {
      const example = EXAMPLES.find((x) => x.id === e.detail) || EXAMPLES[0];
      dispatch({ type: 'example', example });
    };
    window.addEventListener('kinthread:example', onExample);
    return () => window.removeEventListener('kinthread:example', onExample);
  }, []);

  // keep the draft when the user visits another page in this tab (sessionStorage: this device, this tab only)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
      if (saved?.story) dispatch({ type: 'restore', story: saved.story, extra: saved.extra || [], a: saved.a, b: saved.b });
    } catch { /* storage blocked or malformed */ }
  }, []);
  useEffect(() => {
    try {
      if (st.story) sessionStorage.setItem(DRAFT, JSON.stringify({ story: st.story, extra: st.extra, a: st.a, b: st.b }));
      else sessionStorage.removeItem(DRAFT);
    } catch { /* storage blocked: the draft just is not kept */ }
  }, [st.story, st.extra, st.a, st.b]);

  // names: re-detect shortly after typing stops (immediately for examples)
  const ready = model.status === 'ready';
  useEffect(() => {
    if (!ready) return;
    const id = ++detectSeq.current;
    const story = st.story;
    const t = setTimeout(async () => {
      try {
        const p = prepare(story);   // exam questions: question pulled out, letters as names
        const r = await detectPeople(p.model, [...st.extra, ...p.letters]);
        if (id === detectSeq.current) dispatch({ type: 'people', story, people: r.people, tokens: r.tokens });
      } catch { /* model failures surface through the model store */ }
    }, st.want || !story ? 0 : 220);
    return () => clearTimeout(t);
  }, [ready, st.story, st.extra, st.want]);

  const words = countWords(st.story);
  const maxTokens = model.info?.maxTokens ?? 304;
  const measured = st.detected === st.story;
  const over = measured ? st.tokens > maxTokens : words > WORD_LIMIT;
  const running = st.run?.status === 'running';
  const reason = !ready ? (model.status === 'error' ? 'The model could not load. See the map panel.'
    : model.status === 'idle' ? 'Download the model first (one time), then solve.' : 'The model is still loading. You can write your story meanwhile.')
    : !st.story.trim() ? 'Write a story or load an example.'
      : over ? 'The story is longer than the model can read. Shorten it to solve.'
        : !measured ? 'Finding the people in your story\u2026'
          : st.people.length > MAX_PEOPLE ? `The model can follow at most ${MAX_PEOPLE} people in one story; this one has ${st.people.length}. Shorten it to solve.`
        : !st.a || !st.b ? 'Pick two people from the names found.'
          : null;

  const trace = useCallback(async ({ story, a, b, extra }) => {
    const id = ++runSeq.current;
    dispatch({ type: 'runStart', id, story, a, b, extra });
    try {
      const p = prepare(story);
      const r = await askModel(p.model, a, b, [...extra, ...p.letters]);
      dispatch({ type: 'runDone', id, result: r.result, trace: r.trace, roundTripMs: r.roundTripMs });
    } catch (e) {
      dispatch({ type: 'runError', id, error: { code: e.code || 'inference', message: e.message } });
    }
  }, []);

  const canTrace = !reason && !running;
  const onTrace = () => { if (canTrace) trace(st); };

  // examples trace once their people are detected; picking both people (or swapping) traces at once
  useEffect(() => { if (st.autoRun && !reason) trace(st); }, [st.autoRun]); // eslint-disable-line react-hooks/exhaustive-deps

  // on small screens the map sits below: bring a new result into view
  const shownId = st.run?.status === 'done' ? st.run.id : null;
  useEffect(() => {
    if (!shownId || !mapRef.current) return;
    const r = mapRef.current.getBoundingClientRect();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (r.top > window.innerHeight - 120 || r.bottom < 0) mapRef.current.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [shownId]);

  const focusEditor = () => editorRef.current?.focus();
  const focusPicker = (slot) => {
    if (slot) dispatch({ type: 'slot', slot });
    pickerRef.current?.focus();
  };

  const message = st.run?.status === 'done' ? announce(st.run) : st.run?.status === 'error' ? 'Solving failed.' : '';

  return (
    <section className={`container ${s.bench}`} aria-label="Workbench" id="workbench">
      <div className={s.inputs}>
        <StoryEditor
          ref={editorRef}
          story={st.story}
          words={words}
          tokens={measured ? st.tokens : null}
          maxTokens={maxTokens}
          over={over}
          onChange={(story) => { const q = splitQuestion(story); dispatch({ type: 'story', story, want: q.a ? { a: q.a, b: q.b } : null }); }}
          onClear={() => { dispatch({ type: 'clear' }); focusEditor(); }}
          onSubmit={onTrace}
        />
        <Examples onPick={(example) => dispatch({ type: 'example', example })} />
        {process.env.NODE_ENV !== 'production' && <DevData dispatch={dispatch} demo={EXAMPLES[0]} />}
        <PeoplePicker
          ref={pickerRef}
          state={st}
          ready={ready}
          measured={measured}
          dispatch={dispatch}
        />
        <TraceBar reason={reason} running={running} canTrace={canTrace} onTrace={onTrace} />
      </div>
      <div className={s.output} ref={mapRef}>
        <MapPanel
          model={model}
          state={st}
          words={words}
          maxTokens={maxTokens}
          onRetryTrace={onTrace}
          onEditStory={focusEditor}
          onChoose={focusPicker}
          onPick={(name) => dispatch({ type: 'choose', name })}
        />
      </div>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">{message}</div>
    </section>
  );
}
