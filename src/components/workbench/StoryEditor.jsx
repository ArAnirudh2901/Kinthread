'use client';
import { forwardRef, useId, useMemo, useRef } from 'react';
import { useShapeMorph } from '@/lib/useShapeMorph';
import { contradictions } from '@/lib/consistency';
import { spokenClue } from '@/lib/exam';
import { WORD_LIMIT } from '@/lib/story';
import s from './StoryEditor.module.css';

const StoryEditor = forwardRef(function StoryEditor({ story, words, tokens, maxTokens, over, onChange, onClear, onSubmit, undo, onUndo }, ref) {
  const id = useId();
  const issues = useMemo(() => contradictions(story), [story]);
  const clearBox = useRef(null);
  useShapeMorph(clearBox, undo ? 'undo' : 'idle');   // Clear becomes the undo toast and back
  return (
    <div className={s.editor}>
      <div className={s.head}>
        <label htmlFor={id} className="step"><span className="step-num" aria-hidden="true">1</span>Write a family story</label>
        <div ref={clearBox} className={`${s.clearBox} morph`} data-state={undo ? 'undo' : 'idle'} role={undo ? 'status' : undefined}>
          {undo
            ? <><span className={s.undoText}>Story cleared</span><button type="button" className={s.undoBtn} onClick={onUndo}>Undo</button><span className={s.drain} aria-hidden="true" /></>
            : <button type="button" className={s.clear} onClick={onClear} disabled={!story}>Clear</button>}
        </div>
      </div>
      <textarea
        ref={ref}
        id={id}
        className={s.input}
        value={story}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(); } }}
        placeholder="Write a short family story, or paste an exam question like: A is the brother of B. C is the father of A. How is C related to B?"
        name="story"
        autoComplete="off"
        rows={6}
        maxLength={6000}
        spellCheck
        aria-describedby={`${id}-count`}
        aria-invalid={over || undefined}
        data-over={over || undefined}
      />
      <div className={s.foot} id={`${id}-count`}>
        <span className={s.count} data-over={over || undefined}>
          {over && <WarnIcon />}
          <span className="mono">{words}</span> / {WORD_LIMIT} words
          {over && <strong className={s.overText}>{tokens != null && tokens > maxTokens ? ' — too long for the model' : ' — over the limit'}</strong>}
        </span>
      </div>
      {issues.length > 0 && (
        <div className={s.tip} role="status">
          <strong>The story contradicts itself.</strong> {issues[0].message}
          {issues.length > 1 ? ` (${issues.length - 1} more)` : ''} The answer may not make sense until it is fixed.
        </div>
      )}
      {spokenClue(story) && (
        <p className={s.tip}>
          Spoken-clue puzzles (&ldquo;Pointing to a photo, A said&hellip;&rdquo;) are not supported yet. Write the facts plainly instead,
          like &ldquo;B is the brother of A.&rdquo;
        </p>
      )}
    </div>
  );
});

function WarnIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className={s.warn}>
      <path d="M8 1.8 15 14H1L8 1.8Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.2v3.6M8 11.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default StoryEditor;
