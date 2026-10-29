'use client';
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { scrollToTarget } from '@/lib/smooth-scroll';
import { askModel, checkReleaseOnPageLoad, detectPeople, modelOnDevice, startModel } from '@/lib/model/client';
import { useModel } from '@/lib/model/useModel';
import { gateStore, requestModel } from '@/lib/model/gate';
import { mbText } from '@/lib/format';
import { announce } from '@/lib/kinds';
import { EXAMPLES } from '@/lib/examples';
import { prepare, readerInput, splitQuestion } from '@/lib/exam';
import { readShare } from '@/lib/share';
import { MAX_PEOPLE, WORD_LIMIT, countWords } from '@/lib/story';
import MapPanel from '@/components/map/MapPanel';
import DevData from './DevData';
import ModelGate from '@/components/map/ModelGate';
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

  // returning visitors start at once; a first visit asks first (ModelGate)
  useEffect(() => {
    checkReleaseOnPageLoad().then(() => { if (modelOnDevice()) startModel(); });
  }, []);

  // A release notice on another route sends the visitor here and opens the existing model download flow.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('updateModel') !== '1') return;
    url.searchParams.delete('updateModel');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    requestModel(document.querySelector('[data-solve]'), { update: true });
  }, []);

  // the hero's "Try an example" button
  useEffect(() => {
    const onExample = (e) => {
      const example = EXAMPLES.find((x) => x.id === e.detail) || EXAMPLES[0];
      dispatch({ type: 'example', example });
    };
    window.addEventListener('kinthread:example', onExample);
    return () => window.removeEventListener('kinthread:example', onExample);
  }, []);

  // a shared question (#story=…) wins over the tab's draft; the hash is then removed so later edits are not overwritten
  useEffect(() => {
    const shared = readShare(location.hash);
    if (shared) {
      dispatch({ type: 'example', example: shared });
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
      if (typeof saved?.story === 'string' && saved.story) dispatch({ type: 'restore', story: saved.story, extra: Array.isArray(saved.extra) ? saved.extra : [], a: saved.a, b: saved.b });
    } catch { /* storage blocked or malformed */ }
  }, []);
  useEffect(() => {
    try {
      if (st.story) sessionStorage.setItem(DRAFT, JSON.stringify({ story: st.story, extra: st.extra, a: st.a, b: st.b }));
      else sessionStorage.removeItem(DRAFT);
    } catch { /* storage blocked: the draft just is not kept */ }
  }, [st.story, st.extra, st.a, st.b]);

  // names: re-detect shortly after typing stops (immediately for examples). While the model window is still on screen
  // nothing runs, so the answer builds in view once it has shrunk back into the button.
  const gateOpen = useSyncExternalStore(gateStore.subscribe, gateStore.open, gateStore.serverOpen);
  const ready = model.status === 'ready' && !gateOpen;
  useEffect(() => {
    if (!ready) return;
    const id = ++detectSeq.current;
    const story = st.story;
    const t = setTimeout(async () => {
      try {
        const p = prepare(story);   // v8: question pulled out, letters as names; v10 reads the text as written
        const r = await detectPeople(p.model, [...st.extra, ...p.letters], { text: story, extra: st.extra, asked: false });
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
  // without the model, Solve stays available: pressing it opens the download window (lib/model/gate.js)
  const reason = model.status === 'error' ? 'The model could not load. See the map panel.'
    : !st.story.trim() ? 'Write a story or load an example.'
      : !ready && over ? 'The story is longer than the model can read. Shorten it to solve.'
      : !ready ? null
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
      const r = await askModel(p.model, a, b, [...extra, ...p.letters], { ...readerInput(story, a, b), extra });
      dispatch({ type: 'runDone', id, result: r.result, trace: r.trace, roundTripMs: r.roundTripMs });
    } catch (e) {
      dispatch({ type: 'runError', id, error: { code: e.code || 'inference', message: e.message } });
    }
  }, []);

  const note = !ready && !reason && model.status !== 'ready'
    ? (model.status === 'idle' ? `Solving downloads the AI once (${mbText(model.total)}), then it runs on this device.` : 'The AI is loading. Solve shows its progress.')
    : null;
  const canTrace = !reason && !running;
  const solveAfterLoad = useRef(null);   // autoRun count when Solve asked for the model
  const onTrace = (e) => {
    if (!canTrace) return;
    if (model.status !== 'ready' || gateOpen) {
      solveAfterLoad.current = st.autoRun;
      requestModel(e?.currentTarget || document.querySelector('[data-solve]'));
      return;
    }
    trace(st);
  };

  // examples trace once their people are detected; picking both people (or swapping) traces at once
  useEffect(() => { if (st.autoRun && !reason) trace(st); }, [st.autoRun]); // eslint-disable-line react-hooks/exhaustive-deps

  // on small screens the map sits below: bring a new result into view
  const shownId = st.run?.status === 'done' ? st.run.id : null;
  useEffect(() => {
    if (!shownId || !mapRef.current) return;
    const r = mapRef.current.getBoundingClientRect();
    if (r.top > window.innerHeight - 120 || r.bottom < 0) scrollToTarget(mapRef.current);
  }, [shownId]);

  // Clear can be undone for a few seconds
  const [undo, setUndo] = useState(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  const focusEditor = () => editorRef.current?.focus();
  const focusPicker = (slot) => {
    if (slot) dispatch({ type: 'slot', slot });
    pickerRef.current?.focus();
  };

  // after the window closes: solve if both people are known (unless an example or question is already solving),
  // otherwise point at the picker
  useEffect(() => {
    if (!ready || !measured || solveAfterLoad.current == null) return;
    const clicked = solveAfterLoad.current;
    solveAfterLoad.current = null;
    if (st.autoRun !== clicked) return;
    if (!reason) trace(st);
    else if (!st.a || !st.b) focusPicker();
  }, [ready, measured, reason]); // eslint-disable-line react-hooks/exhaustive-deps
  const message = st.run?.status === 'done' ? announce(st.run) : st.run?.status === 'error' ? 'Solving failed.' : '';

  return (
    <section className={`container ${s.bench}`} aria-label="Workbench" id="workbench">
      <ModelGate />
      <div className={s.inputs}>
        <StoryEditor
          ref={editorRef}
          story={st.story}
          words={words}
          tokens={measured ? st.tokens : null}
          maxTokens={maxTokens}
          over={over}
          onChange={(story) => { setUndo(null); const q = splitQuestion(story); dispatch({ type: 'story', story, want: q.a ? { a: q.a, b: q.b } : null }); }}
          onClear={() => { if (st.story) setUndo({ story: st.story, extra: st.extra, a: st.a, b: st.b }); dispatch({ type: 'clear' }); focusEditor(); }}
          undo={undo}
          onUndo={() => { dispatch({ type: 'restore', ...undo }); setUndo(null); focusEditor(); }}
          onSubmit={onTrace}
        />
        <Examples onPick={(example, el) => { dispatch({ type: 'example', example }); if (model.status !== 'ready') requestModel(el); }} />
        {process.env.NODE_ENV !== 'production' && <DevData dispatch={dispatch} demo={EXAMPLES[0]} />}
        <PeoplePicker
          ref={pickerRef}
          state={st}
          ready={ready}
          measured={measured}
          dispatch={dispatch}
        />
        <TraceBar reason={reason} note={note} running={running} canTrace={canTrace} onTrace={onTrace} />
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
