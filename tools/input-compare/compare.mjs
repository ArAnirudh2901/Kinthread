// v10 input comparison: each question answered through the synced browser pipeline (Node + Pyodide + WASM reader,
// public/r/<hash>/v10-pipeline.js) with
//   current  the old Workbench input: exam.js prepare().model (question and options removed, "X is the R of Y"
//            reworded for v8) plus the picker's question
//   plain    the same without the rewording
//   raw      the pasted text as written: kinlogic finds the people, the question and the options
//   ship     what the Workbench sends now (exam.js readerInput)
// Questions: the page's examples plus questions.json (generated with known answers by the model repo's
// `python -m eval.web_input_set`; never the private real dev/test questions). Latency is this machine's, all tiers on
// the threaded reader (the tier only sets the beam).
//   node tools/input-compare/compare.mjs [out.jsonl] [tier=high|balanced|low] [variants=current,plain,raw,ship]
//   node tools/input-compare/compare.mjs --report run.jsonl...
import { createReadStream } from 'node:fs';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '../..');
const { prepare, readerInput, splitQuestion } = await import(pathToFileURL(path.join(site, 'src/lib/exam.js')).href);
const { EXAMPLES } = await import(pathToFileURL(path.join(site, 'src/lib/examples.js')).href);

// eval/consistency.py norm/agrees: "grandfather" for "paternal grandfather" counts
const norm = (s) => String(s ?? 'none').toLowerCase().replace(/\([^)]*\)/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
const agrees = (a, t) => { a = norm(a); t = norm(t); return a === t || t.endsWith(` ${a}`) || a.endsWith(` ${t}`); };

const generated = JSON.parse(await readFile(path.join(here, 'questions.json'), 'utf8'));
const questions = [
  ...EXAMPLES.map((e) => ({ id: `example-${e.id}`, kind: 'example', text: e.story, a: e.a, b: e.b,
    truth: e.expect.kind === 'unknown' ? 'not related' : e.expect.relation, expectKind: e.expect.kind, asked: !!splitQuestion(e.story).question })),
  ...generated.map((g) => ({ ...g, asked: true })),
];
const byId = new Map(questions.map((q) => [q.id, q]));

const INPUT = {
  current: (q) => { const p = prepare(q.text); return [p.model, q.a, q.b, p.letters]; },
  plain: (q) => { const p = prepare(q.text); return [p.plain, q.a, q.b, p.letters]; },
  raw: (q) => [q.text, q.a, q.b, [], { asked: q.asked }],
  ship: (q) => { const r = readerInput(q.text, q.a, q.b); return [r.text, q.a, q.b, [], { asked: r.asked }]; },
};

function report(rows) {
  const by = new Map();
  for (const r of rows) by.set(r.id, { ...by.get(r.id), [r.variant]: r });
  const variants = Object.keys(INPUT).filter((v) => rows.some((r) => r.variant === v));
  const ids = [...by.keys()];
  const pct = (k, n) => `${k}/${n} = ${(100 * k / Math.max(n, 1)).toFixed(1)}%`;
  const first = (i) => Object.values(by.get(i))[0];
  // what an exam marks: the option letter when the question has options and the input kept them
  const exam = (r) => (byId.get(r.id)?.gold_option && r.option ? r.option === byId.get(r.id).gold_option : r.correct);
  const line = (name, sel, ok = (r) => r.correct) => console.log(name.padEnd(30) + variants.map((v) => {
    const got = sel.map((i) => by.get(i)[v]).filter(Boolean);
    return `${v}: ${pct(got.filter(ok).length, got.length)}`;
  }).join('   '));
  const bucket = (i) => (first(i).kind === 'example' ? 'example' : ['speech', 'identity', 'introduce'].includes(first(i).kind) ? 'described' : 'named');
  console.log(`${ids.length} questions, beam ${rows[0].beam} (${rows[0].tier})`);
  line('all', ids);
  for (const b of ['example', 'named', 'described']) line(`  ${b}`, ids.filter((i) => bucket(i) === b));
  line('  with options', ids.filter((i) => first(i).options));
  line('  question found by exam.js', ids.filter((i) => first(i).jsFound));
  line('  question missed by exam.js', ids.filter((i) => !first(i).jsFound && first(i).kind !== 'example'));
  line('exam score (option letter)', ids, exam);
  for (const v of variants) {
    const got = ids.map((i) => by.get(i)[v]).filter(Boolean);
    const ms = got.map((r) => r.ms).sort((x, y) => x - y);
    const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
    console.log(`${v.padEnd(8)} latency ms: mean ${Math.round(ms.reduce((s, x) => s + x, 0) / ms.length)}  median ${q(0.5)}  p90 ${q(0.9)}  max ${ms.at(-1)}`
      + `  | reader calls mean ${(got.reduce((s, r) => s + (r.decodeCalls || 0), 0) / got.length).toFixed(2)}, none ${got.filter((r) => !r.decodeCalls).length}`);
  }
  for (const v of variants.filter((x) => x !== 'current' && variants.includes('current'))) {
    const diff = ids.filter((i) => by.get(i)[v] && by.get(i).current && by.get(i)[v].correct !== by.get(i).current.correct);
    console.log(`${v} vs current: ${diff.filter((i) => by.get(i)[v].correct).length} fixed, ${diff.filter((i) => by.get(i).current.correct).length} broken`);
    for (const i of diff) console.log(`   ${by.get(i)[v].correct ? '+' : '-'} ${i.padEnd(18)} truth ${JSON.stringify(by.get(i)[v].truth)}  current ${JSON.stringify(by.get(i).current.relation)}  ${v} ${JSON.stringify(by.get(i)[v].relation)}`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--report') {
  for (const file of args.slice(1)) report((await readFile(file, 'utf8')).trim().split('\n').map((l) => JSON.parse(l)));
  process.exit(0);
}
const [out = path.join(here, 'result.jsonl'), tier = 'high', which = 'current,plain,raw,ship'] = args;
const release = JSON.parse(await readFile(path.join(site, 'public/model-release.json'), 'utf8'));
const model = release.model;
const modelDir = path.join(site, 'public/m', model.contentHash);
const { initializeV10, askV10 } = await import(pathToFileURL(path.join(site, 'public/r', release.runtimeHash, 'v10-pipeline.js')).href);
const getFile = async (entry) => new Uint8Array(await readFile(path.join(modelDir, entry.file)));
const weightsResponse = (entry) => {
  let index = 0, current = null;
  return new Response(new ReadableStream({
    async pull(controller) {
      while (true) {
        if (!current) {
          if (index === entry.parts.length) { controller.close(); return; }
          current = createReadStream(path.join(modelDir, entry.parts[index++].file))[Symbol.asyncIterator]();
        }
        const { value, done } = await current.next();
        if (done) { current = null; continue; }
        controller.enqueue(value);
        return;
      }
    },
  }));
};

const variants = which.split(',');
const t0 = performance.now();
const ready = await initializeV10({ model, ctx: {}, getFile, weightsResponse, engine: 'mt', deviceTier: tier, maxThreads: 4 });
console.log(`runtime ${release.runtimeHash}, model ${model.contentHash}: ready in ${Math.round(performance.now() - t0)} ms, beam ${ready.beam}, ${ready.threads} threads`);
askV10(EXAMPLES[1].story, EXAMPLES[1].a, EXAMPLES[1].b);   // warm-up, not recorded
await writeFile(out, '');
const rows = [];
for (const [i, q] of questions.entries()) {
  const split = splitQuestion(q.text);
  const jsFound = !!split.question && split.a === q.a && split.b === q.b;
  for (const v of variants.map((_, k) => variants[(k + i) % variants.length])) {   // rotate: no variant always runs first
    const input = INPUT[v](q);
    const t = performance.now();
    let result = null, error = null;
    try { ({ result } = askV10(...input)); } catch (e) { error = String(e?.message || e); }
    const relation = result?.relation ?? (result?.kind === 'unknown' ? 'not related' : null);
    const row = { id: q.id, kind: q.kind, variant: v, tier, beam: ready.beam, jsFound, options: !!q.options, truth: q.truth,
      input: input[0], relation, option: result?.option ?? null, status: result?.status, uiKind: result?.kind,
      confidence: result?.confidence, correct: q.expectKind === 'unknown' ? result?.kind === 'unknown' : agrees(relation, q.truth),
      ms: Math.round(performance.now() - t), forwardMs: Math.round(result?.forwardMs || 0), decodeCalls: result?.decodeCalls,
      decodeSteps: result?.decodeSteps, error };
    rows.push(row);
    await appendFile(out, `${JSON.stringify(row)}\n`);
    console.log(`${q.id.padEnd(22)} ${v.padEnd(8)} ${row.correct ? 'ok ' : 'BAD'} ${String(relation).padEnd(20)} ${row.ms} ms`);
  }
}
report(rows);
process.exit(0);
