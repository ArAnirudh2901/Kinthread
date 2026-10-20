'use client';
import { personLabel, possessive } from '@/lib/story';
import { workedSteps } from '@/lib/worked';
import s from './Solution.module.css';

// The worked answer in words, in step with the map: the question, each fact with the sentence it
// comes from and what it adds up to so far, then the answer. Rows and buttons move the map's playhead.

function Who({ name, role }) {
  return <b className={s.who} data-role={role}>{personLabel(name)}</b>;
}

export default function Solution({ run, tentative, progress, player }) {
  const { result: r, a, b } = run;
  const { rows: plain, path, final } = workedSteps(run, tentative);
  const words = path.edges;
  const total = words.length + 2;   // question, one per fact, answer
  const current = progress ? progress.step : total - 1;
  const playing = !!progress?.playing;
  const state = (k) => (k < current ? 'done' : k === current ? 'active' : 'todo');
  const go = (k) => player.current?.goto(k);
  const A = personLabel(a);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); player.current?.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); player.current?.prev(); }
  };

  const mismatch = final.word && final.word !== r.relation;
  const words18 = new Set(['aunt', 'brother', 'daughter', 'daughter-in-law', 'father', 'father-in-law', 'granddaughter', 'grandfather', 'grandmother', 'grandson', 'mother', 'mother-in-law', 'nephew', 'niece', 'sister', 'son', 'son-in-law', 'uncle']);

  const rows = [
    {
      key: 'q',
      badge: '?',
      tone: 'question',
      body: (
        <span className={s.main}>
          The question: how is <Who name={b} role="b" /> related to <Who name={a} role="a" />?
        </span>
      ),
      say: `The question: how is ${personLabel(b)} related to ${A}?`,
    },
    ...plain.slice(1, -1).map((row, i) => ({
      key: `f${i}`,
      badge: row.badge,
      tone: 'fact',
      body: (
        <>
          <span className={s.main}>{row.text}</span>
          {row.quote
            ? <span className={s.quote}><span className={s.from}>From the story</span> &ldquo;{row.quote}&rdquo;</span>
            : <span className={s.quote}><span className={s.from}>Read from the story</span> the model inferred this from the wording.</span>}
          {row.so && (
            <span className={s.so}>
              {row.so}
              {row.note ? <span className={s.note}> Usually; {row.note}.</span> : null}
            </span>
          )}
        </>
      ),
      say: `Step ${row.badge}: ${row.text}${row.so ? ` ${row.so}` : ''}`,
    })),
    {
      key: 'a',
      badge: '✓',
      tone: 'answer',
      body: (
        <>
          <span className={s.main}>
            {tentative ? 'Best guess: ' : 'Answer: '}
            <Who name={b} role="b" /> is {possessive(A)} <b className={s.rel}>{r.relation}</b>.
          </span>
          {mismatch && (
            <span className={s.warn}>
              {words18.has(final.word)
                ? <>Check this one: these steps add up to <b>{final.word}</b>, but the model answered <b>{r.relation}</b>. Small models can slip, so read the story again.</>
                : <>These steps add up to <b>{final.word}</b>, which is not one of the 18 answers this model can give, so it chose the closest one it knows.</>}
            </span>
          )}
          {!final.word && words.length > 1 && (
            <span className={s.note}>The steps alone could fit more than one relationship; the model chose {r.relation}.</span>
          )}
        </>
      ),
      say: `${tentative ? 'Best guess' : 'Answer'}: ${personLabel(b)} is ${possessive(A)} ${r.relation}.`,
    },
  ];

  return (
    <>
    <details className={s.solution} onKeyDown={onKeyDown}>
      <summary className={s.summary}>
        <span>All steps, with the sentences from the story</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={s.chev}><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <section aria-label="Worked answer, step by step" className={s.inner}>
      <ol className={s.rows}>
        {rows.map((row, k) => (
          <li key={row.key} data-state={state(k)} data-tone={row.tone}>
            <button type="button" className={s.row} onClick={() => go(k)} aria-current={k === current ? 'step' : undefined}>
              <span className={s.badge} aria-hidden="true">{row.badge}</span>
              <span className={s.body}>{row.body}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className={s.hint}>Tip: tap a step to jump to it, or use the arrow keys.</p>
      </section>
    </details>
    {/* outside the fold: a closed <details> hides its content from screen readers too */}
    <div className="visually-hidden" aria-live="polite">{playing ? '' : rows[current]?.say}</div>
    </>
  );
}
