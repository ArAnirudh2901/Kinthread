'use client';
import { forwardRef, useId, useRef, useState } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { findInStory } from '@/lib/story';
import s from './PeoplePicker.module.css';

// The question itself is the picker: "How is [B] related to [A]?" Tap a blank, then a name.
// Blanks fill in reading order (B first), the way the question is said aloud.
const SLOTS = {
  b: { label: 'first blank', empty: 'someone' },
  a: { label: 'second blank', empty: 'someone' },
};

const PeoplePicker = forwardRef(function PeoplePicker({ state, ready, measured, dispatch }, ref) {
  const { people, extra, story, slot, a, b } = state;
  const helpId = useId();
  const root = useRef(null);

  const help = !ready ? 'Names appear here once the model has loaded.'
    : !story.trim() ? 'Write a story first. The names in it appear here.'
      : !measured ? 'Finding the names…'
        : !people.length ? 'No names found yet. Names should start with a capital letter, like “Ashley”.'
          : a && b ? 'To ask something else, tap a blank, then a name.'
            : `Tap a name to fill the ${SLOTS[slot].label}.`;

  // the arrows flip half a turn per swap, always landing upright even when clicked mid-turn
  const { contextSafe } = useGSAP({ scope: root });
  const swap = contextSafe((e) => {
    dispatch({ type: 'swap' });
    if (prefersReducedMotion()) return;
    const icon = e.currentTarget.querySelector('svg');
    const to = Math.round(gsap.getProperty(icon, 'rotation') / 180) * 180 + 180;
    gsap.to(icon, { rotation: to, duration: 0.55, ease: 'back.out(1.8)', transformOrigin: '50% 50%', overwrite: true });
  });

  const blank = (key) => {
    const value = state[key];
    const x = SLOTS[key];
    return (
      <button
        type="button"
        className={s.blank}
        data-slot={key}
        data-empty={!value || undefined}
        aria-pressed={slot === key}
        aria-label={`${value || 'Not chosen'}, ${x.label}. Tap, then choose a name.`}
        onClick={() => dispatch({ type: 'slot', slot: key })}
      >
        <span className={s.value}>{value || x.empty}</span>
      </button>
    );
  };

  return (
    <section className={s.picker} aria-labelledby={`${helpId}-title`} ref={root}>
      <h2 id={`${helpId}-title`} className="step"><span className="step-num" aria-hidden="true">2</span>Pick two people</h2>

      <div className={s.questionRow}>
        <p className={s.question} ref={ref} tabIndex={-1}>
          How is {blank('b')} related to {blank('a')}?
        </p>
        <button type="button" className={s.swap} onClick={swap} disabled={!a || !b} aria-label="Swap the two people" title="Swap">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M6 3v13M6 16l-3-3M6 16l3-3M14 17V4M14 4l-3 3M14 4l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p className={s.help} id={helpId} aria-live="polite">{help}</p>

      {people.length > 0 && (
        <ul className={s.chips} aria-label="People found in the story" data-stale={!measured || undefined}>
          {people.map((name) => {
            const chosen = a === name || b === name;
            const added = extra.includes(name);
            return (
              <li key={name} className={s.chipItem}>
                <button
                  type="button"
                  className={s.chip}
                  data-role={chosen || undefined}
                  aria-describedby={helpId}
                  disabled={!measured}
                  aria-label={`${name}. Put in the ${SLOTS[slot].label}.`}
                  onClick={() => dispatch({ type: 'choose', name })}
                >
                  {name}
                </button>
                {added && (
                  <button type="button" className={s.remove} aria-label={`Remove ${name}`} onClick={() => dispatch({ type: 'removeName', name })}>
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ready && story.trim() && <AddName story={story} people={people} onAdd={(name) => dispatch({ type: 'addName', name })} />}
    </section>
  );
});

function AddName({ story, people, onAdd }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  const submit = (e) => {
    e.preventDefault();
    const typed = draft.trim();
    if (!typed) return setError('Type a name as it is written in the story.');
    if (/\s/.test(typed)) return setError('Use one word: the name exactly as it appears.');
    const name = findInStory(story, typed);
    if (!name) return setError(`“${typed}” does not appear in the story as a whole word.`);
    if (people.includes(name)) return setError(`${name} is already in the list.`);
    onAdd(name);
    setDraft('');
    setError('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className={s.missing} onClick={() => setOpen(true)}>
        Missing someone? Add a name
      </button>
    );
  }
  return (
    <form className={s.addForm} onSubmit={submit} noValidate>
      <label htmlFor={id} className={s.addLabel}>Name, exactly as written in the story</label>
      <div className={s.addRow}>
        <input
          id={id}
          className={s.addInput}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(''); }}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button type="submit" className={s.addBtn}>Add</button>
        <button type="button" className={s.cancel} onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
      </div>
      {error && <p id={`${id}-err`} className={s.addError} role="alert">{error}</p>}
    </form>
  );
}

export default PeoplePicker;
