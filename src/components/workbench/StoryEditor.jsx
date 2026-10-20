'use client';
import { forwardRef, useId } from 'react';
import { spokenClue } from '@/lib/exam';
import { WORD_LIMIT } from '@/lib/story';
import s from './StoryEditor.module.css';

const StoryEditor = forwardRef(function StoryEditor({ story, words, tokens, maxTokens, over, onChange, onClear, onSubmit }, ref) {
  const id = useId();
  return (
    <div className={s.editor}>
      <div className={s.head}>
        <label htmlFor={id} className="step"><span className="step-num" aria-hidden="true">1</span>Write a family story</label>
        <button type="button" className={s.clear} onClick={onClear} disabled={!story}>Clear</button>
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
