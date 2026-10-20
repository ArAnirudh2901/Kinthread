'use client';
import s from './TokenStrip.module.css';

const SPECIAL = new Set(['<bos>', '<q>', '<s>', '<c>', '<sep>', '<a>', '<unk>', '<nofact>']);

function Token({ t, entities }) {
  const name = entities[t];
  if (name) return <li className={s.ent} title={name}>{t}<span className="visually-hidden"> ({name})</span></li>;
  return <li className={SPECIAL.has(t) ? s.special : undefined}>{t}</li>;
}

// What the model actually read and wrote: names become entity ids so it reasons about roles, not names.
export default function TokenStrip({ trace, result }) {
  const legend = Object.entries(trace.entities);
  const written = trace.chain.flatMap((step) => [...step.split(' '), '<sep>']);
  if (result.kind !== 'unknown') written.push('<a>', result.relation);
  return (
    <div className={s.strip} translate="no">
      <p className={s.label}>What the model read</p>
      <ol className={s.tokens} aria-label="Input tokens">
        {trace.tokens.map((t, i) => <Token key={i} t={t} entities={trace.entities} />)}
      </ol>
      {result.kind !== 'unknown' && (
        <>
          <p className={s.label}>What it wrote before answering</p>
          <ol className={`${s.tokens} ${s.written}`} aria-label="Generated tokens">
            {written.map((t, i) => <Token key={i} t={t} entities={trace.entities} />)}
          </ol>
        </>
      )}
      <ul className={s.legend} aria-label="Entity ids">
        {legend.map(([id, name]) => <li key={id}><code>{id}</code> {name}</li>)}
      </ul>
      <p className={s.note}>
        The written steps are the model&rsquo;s own chain of thought, produced before its answer. They show what it wrote
        down, not every computation inside the network.
      </p>
    </div>
  );
}
