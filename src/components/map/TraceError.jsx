'use client';
import s from './results.module.css';

export default function TraceError({ error, onRetry }) {
  return (
    <div className={s.error} role="alert">
      <p className={s.badge} data-tone="attention">Trace failed</p>
      <h3 className={`display ${s.headline}`}>Something went wrong while tracing.</h3>
      <p className={s.lede}>Your story and selection are unchanged. Trying again usually works.</p>
      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={onRetry}>Try again</button>
      </div>
      <details className={s.tech}>
        <summary>Technical details</summary>
        <pre>{`${error.code}: ${error.message}`}</pre>
      </details>
    </div>
  );
}
