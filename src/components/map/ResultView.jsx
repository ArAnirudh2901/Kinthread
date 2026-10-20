'use client';
import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { kindOf, missingPeople, RULES } from '@/lib/kinds';
import { score } from '@/lib/format';
import { possessive } from '@/lib/story';
import ModelDetails from './ModelDetails';
import Solution from './Solution';
import s from './results.module.css';

// Result kind -> view. The only place a kind picks a component (presentation data lives in lib/kinds.js).
// The map above draws the path; these views are the words under it.
const VIEWS = {
  answer: Answer,
  'not sure': Tentative,
  unknown: Unknown,
  refused: Refused,
  same: Same,
  'too long': TooLong,
};

export default function ResultView({ run, stale, shown, progress, player, onRetry, ...rest }) {
  const View = VIEWS[run.result.kind] || Unexpected;
  return (
    <div className={s.result} data-tone={kindOf(run.result)?.tone}>
      {stale && (
        <div className={s.stale}>
          <span>The story or the people changed since this answer.</span>
          <button type="button" className={s.linkBtn} onClick={onRetry}>Solve again</button>
        </div>
      )}
      <View run={run} shown={shown} progress={progress} player={player} {...rest} />
    </div>
  );
}

function Badge({ result }) {
  const k = kindOf(result);
  if (!k) return null;
  return (
    <p className={s.badge} data-tone={k.tone}>
      <BadgeIcon name={k.icon} />
      {k.badge}
    </p>
  );
}

function BadgeIcon({ name }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {name === 'check' && <path d="M3 8.5l3 3 7-7" {...p} />}
      {name === 'tilde' && <path d="M2.5 9c2-3 3.5-3 5.5-1s3.5 2 5.5-1" {...p} />}
      {name === 'gap' && <path d="M1.5 8h4M10.5 8h4M7 5.5l2 5" {...p} />}
      {name === 'alert' && <><path d="M8 2 15 14H1L8 2Z" {...p} /><path d="M8 6.5v3.2M8 11.7v.1" {...p} /></>}
    </svg>
  );
}

// The words appear as the thread finishes drawing (opacity + transform only)
function Reveal({ show, children }) {
  const el = useRef(null);
  useGSAP(() => {
    if (!show) return;
    if (prefersReducedMotion()) { gsap.set(el.current, { autoAlpha: 1 }); return; }
    gsap.fromTo(el.current.children, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.05 });
  }, { dependencies: [show], scope: el });
  return <div ref={el} className={s.copy} data-pending={!show || undefined}>{children}</div>;
}

// Sits above the map: asks the question while the answer is worked out, then gives the answer.
export function Headline({ run, shown, tentative }) {
  const { result: r, a, b } = run;
  if (!shown) {
    return (
      <div className={s.copy}>
        <p className={s.working}>Working it out, step by step</p>
        <h3 className={`display ${s.headline} ${s.quiet}`}>How is {b} related to {a}?</h3>
      </div>
    );
  }
  return (
    <Reveal show>
      <Badge result={r} />
      <h3 className={`display ${s.headline}`}>
        {tentative ? 'My best guess: ' : ''}{b} is {possessive(a)}{' '}
        {tentative ? <span className={s.guess}>{r.relation}</span> : <mark className={s.relation}>{r.relation}</mark>}.
      </h3>
    </Reveal>
  );
}

function Answer({ run, info, progress, player }) {
  return (
    <>
      <Solution run={run} progress={progress} player={player} />
      <ModelDetails run={run} info={info} />
    </>
  );
}

function Tentative({ run, info, progress, player }) {
  return (
    <>
      <p className={s.lede}>
        This is a best guess, not a sure answer: the model&rsquo;s reasoning paths disagree (only {score(run.result.share)} of
        their weight ends on it, below the {RULES.minAgreement.toFixed(2)} it needs to be confident).
      </p>
      <Solution run={run} tentative progress={progress} player={player} />
      <p className={s.tip}>Short, direct sentences such as &ldquo;Ashley&rsquo;s daughter Lillian&rdquo; usually help it decide.</p>
      <ModelDetails run={run} info={info} />
    </>
  );
}

function Unknown({ run, info, shown, onEditStory, onChoose }) {
  const { result: r, a, b } = run;
  const byRule = r.relation == null;   // stopped by the co-mention check before the model ran
  return (
    <>
      <Reveal show={shown}>
        <Badge result={r} />
        <h3 className={`display ${s.headline}`}>The story doesn&rsquo;t establish a relationship between {a} and {b}.</h3>
        <p className={s.lede}>
          {byRule
            ? `${a} and ${b} are never mentioned together, or through people who are, so nothing in the text connects them.`
            : `The model could not verify a family path between them. Its estimate that the story gives no link is ${score(r.pUnknown)}, above the ${RULES.unknownThreshold.toFixed(2)} cut-off.`}
        </p>
        <p className={s.tip}>A friend, coworker or neighbour is not family. If they are related, say how in the story.</p>
        <div className={s.actions}>
          <button type="button" className={s.secondary} onClick={onEditStory}>Edit the story</button>
          <button type="button" className={s.secondary} onClick={() => onChoose('b')}>Choose other people</button>
        </div>
      </Reveal>
      {!byRule && <ModelDetails run={run} info={info} />}
    </>
  );
}

function Refused({ run, onChoose }) {
  const missing = missingPeople(run);
  const slot = missing.includes(run.a) ? 'a' : 'b';
  return (
    <div className={s.copy}>
      <Badge result={run.result} />
      <h3 className={`display ${s.headline}`}>I couldn&rsquo;t find that person in the story.</h3>
      <p className={s.lede}>
        {missing.length ? `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not among the people the name model found. ` : ''}
        Choose someone from the people found, or add a name exactly as it is written in the story.
      </p>
      <div className={s.actions}>
        <button type="button" className={s.secondary} onClick={() => onChoose(slot)}>Choose again</button>
      </div>
    </div>
  );
}

function Same({ run, shown, onChoose }) {
  return (
    <Reveal show={shown}>
      <Badge result={run.result} />
      <h3 className={`display ${s.headline}`}>You&rsquo;re comparing the same person.</h3>
      <p className={s.lede}>{run.a} is in both blanks. Pick two different people.</p>
      <div className={s.actions}>
        <button type="button" className={s.secondary} onClick={() => onChoose('b')}>Pick someone else</button>
      </div>
    </Reveal>
  );
}

function TooLong({ words, maxTokens, onEditStory }) {
  return (
    <div className={s.copy}>
      <Badge result={{ kind: 'too long' }} />
      <h3 className={`display ${s.headline}`}>Let&rsquo;s shorten the story.</h3>
      <p className={s.lede}>
        It has {words} words, more than the model can read at once (about 280 words, {maxTokens} tokens including punctuation).
        Keep the sentences that say how people are related and cut the rest.
      </p>
      <div className={s.actions}>
        <button type="button" className={s.secondary} onClick={onEditStory}>Edit the story</button>
      </div>
    </div>
  );
}

function Unexpected({ run }) {
  return (
    <div className={s.copy}>
      <h3 className={`display ${s.headline}`}>The model returned a result this page doesn&rsquo;t recognise.</h3>
      <p className={s.lede}>{run.result.text}</p>
    </div>
  );
}
