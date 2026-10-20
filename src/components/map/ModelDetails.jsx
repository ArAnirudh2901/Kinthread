'use client';
import { CALIBRATION, RULES } from '@/lib/kinds';
import { engineName, ms, score } from '@/lib/format';
import TokenStrip from './TokenStrip';
import s from './ModelDetails.module.css';

const pct = (x) => `${(100 * x).toFixed(1)}%`;

export default function ModelDetails({ run, info }) {
  const r = run.result;
  const decided = r.kind === 'answer' ? `agreement ≥ ${RULES.minAgreement.toFixed(2)} and p(unknown) < ${RULES.unknownThreshold.toFixed(2)}`
    : r.kind === 'not sure' ? `agreement below ${RULES.minAgreement.toFixed(2)}`
      : `p(unknown) ≥ ${RULES.unknownThreshold.toFixed(2)}`;
  const v = CALIBRATION.val, t = CALIBRATION.test;
  return (
    <details className={s.details}>
      <summary>
        <span>Model details</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={s.chev}><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <div className={s.inner}>
        <dl className={s.grid}>
          <div><dt>Result</dt><dd><code>{r.kind}</code><span>{decided}</span></dd></div>
          <div>
            <dt>Agreement</dt>
            <dd><code>{score(r.share)}</code><span>Share of the model&rsquo;s weighted reasoning paths that end in this answer. Not a probability that it is correct.</span></dd>
          </div>
          <div>
            <dt>p(unknown)</dt>
            <dd><code>{score(r.pUnknown)}</code><span>The larger of p(no path) {score(r.pStart)} and 1 &minus; p(verified steps) {score(1 - r.pLink)}.</span></dd>
          </div>
          <div><dt>Inference</dt><dd><code>{ms(r.ms)}</code><span>model time on this device; {ms(run.roundTripMs)} including the hop to the worker</span></dd></div>
          <div><dt>Engine</dt><dd><code>{engineName(info)}</code><span>WebAssembly, exact 32-bit weights</span></dd></div>
          <div><dt>Search</dt><dd><code>beam {RULES.beam}</code><span>{r.views} view, {r.rows} token rows computed</span></dd></div>
        </dl>
        <p className={s.calib}>
          <strong>How often is it right?</strong> With these settings, on {v.questions} held-out stories needing {v.steps} steps,
          confident answers ({v.confident} of them) were correct {pct(v.confidentCorrect)} of the time and tentative guesses {pct(v.tentativeCorrect)}.
          On longer chains ({t.steps} steps): {pct(t.confidentCorrect)} and {pct(t.tentativeCorrect)}. Measured with the people given, not detected.
        </p>
        {run.trace && <TokenStrip trace={run.trace} result={r} />}
      </div>
    </details>
  );
}
