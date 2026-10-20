'use client';

// Last resort for a crash anywhere on a page: say so plainly and offer a way back.
export default function Error({ reset }) {
  return (
    <main id="main" className="container" style={{ paddingBlock: '96px', display: 'grid', gap: 16, justifyItems: 'start' }}>
      <h1 className="display" style={{ margin: 0, fontSize: 'var(--fs-h1)' }}>Something went wrong.</h1>
      <p style={{ margin: 0, color: 'var(--text-2)', maxWidth: '50ch' }}>
        This page hit an unexpected error. Your story is kept in this tab, so trying again usually brings it back.
      </p>
      <button type="button" onClick={reset} style={{ minHeight: 48, padding: '0 22px', border: 0, borderRadius: 999, background: 'var(--answer-fill)', color: 'var(--on-answer)', fontWeight: 600 }}>
        Try again
      </button>
    </main>
  );
}
