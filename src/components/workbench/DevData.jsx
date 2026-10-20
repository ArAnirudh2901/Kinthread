'use client';
import { useEffect } from 'react';
import { FIXTURES } from '@/lib/fixtures.dev';

// Dev-only: swaps the story at the same boundary an example uses, so the real UI meets the worst case.
// Never rendered in production builds. ?data=worst|exam|one|many|long|empty is kept in the URL.
const KEYS = ['demo', ...Object.keys(FIXTURES)];

export default function DevData({ dispatch, demo }) {
  const load = (key) => {
    const url = new URL(location.href);
    if (key === 'demo') url.searchParams.delete('data'); else url.searchParams.set('data', key);
    history.replaceState(null, '', url);
    const f = key === 'demo' ? demo : FIXTURES[key];
    if (!f || !f.story) dispatch({ type: 'clear' });
    else dispatch({ type: 'example', example: { story: f.story, a: f.a, b: f.b } });
  };
  useEffect(() => {
    const key = new URLSearchParams(location.search).get('data');
    if (key && FIXTURES[key]) load(key);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="group" aria-label="Dev data" style={{ position: 'fixed', zIndex: 50, left: '50%', bottom: 12, transform: 'translateX(-50%)', display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: '#ddd', font: '12px system-ui', boxShadow: '0 2px 10px rgb(0 0 0 / 0.25)' }}>
      {KEYS.map((k) => (
        <button key={k} type="button" onClick={() => load(k)} style={{ border: 0, borderRadius: 999, padding: '5px 10px', background: '#fff', color: '#111', cursor: 'pointer' }}>{k}</button>
      ))}
    </div>
  );
}
