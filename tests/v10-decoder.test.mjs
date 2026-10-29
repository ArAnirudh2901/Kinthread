import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { V10Decoder } from '../runtime/v10-decoder.js';
import { readerInput } from '../src/lib/exam.js';

const meta = {
  vocab: ['<pad>', '<unk>', '<bos>', '<c>', '<sep>', '<eos>', '@0', '@1', 'ask'],
  merges: [],
  grammar: {
    maxNew: 16, sided: [], only: [], questions: ['ask'], puzzle: [], groups: [], roles: [],
    relations: [], kin: [], nonkin: [], attributes: [], sides: [], numbers: [],
    countable: [], profs: [],
  },
};

test('v10 grammar permits EOS before facts and after a completed fact', () => {
  const decoder = new V10Decoder({}, meta);
  assert.ok(decoder.allowed([], ['@0']).includes('<eos>'));
  assert.ok(decoder.allowed([';'], ['@0']).includes('<eos>'));
});

test('v10 grammar permits EOS right after a complete statement, like kinlogic.facts.allowed_next', () => {
  const decoder = new V10Decoder({}, meta);
  assert.deepEqual(decoder.allowed(['ask', '@0', '@1'], ['@0', '@1']), [';', '<eos>']);
  assert.ok(!decoder.allowed(['ask', '@0'], ['@0', '@1']).includes('<eos>'));
});

test('v10 budget filter finishes the reading with a question near the token cap', () => {
  const decoder = new V10Decoder({}, meta, 8, 96, 8);
  const ents = ['@0', '@1'];
  assert.ok(decoder.allowed([], ents, 50).includes('@0'));
  assert.deepEqual(decoder.allowed([], ents, 3), ['ask', 'prof']);
  assert.deepEqual(decoder.allowed(['ask', '@0', '@1'], ents, 2), ['<eos>']);
});

test('v10 beam lets each decoded token attend to itself and stops at k finished readings', () => {
  const ids = new Map(meta.vocab.map((token, i) => [token, i]));
  const next = new Map([[ids.get('ask'), '@0'], [ids.get('@0'), '@1'], [ids.get('@1'), '<eos>']]);
  const distribution = (token) => {
    const out = new Float32Array(meta.vocab.length).fill(-20);
    out[ids.get(next.get(token) ?? 'ask')] = 0;
    return out;
  };
  const seen = [];
  const reader = {
    prefill(inputIds) { return { prefixLength: inputIds.length, logprobs: distribution(ids.get('<c>')) }; },
    forward(rows) { seen.push(...rows); return rows.map((row) => ({ row })); },
    logProbabilities(state) { return distribution(state.row.token); },
  };
  const decoder = new V10Decoder(reader, meta, 1, 16);
  assert.equal(decoder.generate(['@0', '@1'], 1)[0][0], 'ask @0 @1');
  assert.ok(seen.length && seen.every((row) => row.context.at(-1) === row.slot && row.context.includes(row.position - 1)));
  assert.equal(decoder.lastMetrics.decodeSteps, 4);   // ask, @0, @1, <eos>: no forced ';' and no steps after k
});

test('v10 beam treats reader outputs as log probabilities and ends after a completed fact', () => {
  const ids = new Map(meta.vocab.map((token, i) => [token, i]));
  const favored = new Map([
    [ids.get('ask'), ids.get('@0')],
    [ids.get('@0'), ids.get('@1')],
    [ids.get('@1'), ids.get('<sep>')],
    [ids.get('<sep>'), ids.get('<eos>')],
  ]);
  const distribution = (token) => {
    const out = new Float32Array(meta.vocab.length).fill(-20);
    out[favored.get(token) ?? ids.get('ask')] = 0;
    return out;
  };
  const reader = {
    prefill(inputIds) { return { prefixLength: inputIds.length, logprobs: distribution(ids.get('<c>')) }; },
    forward(rows) { return rows.map((row) => ({ row })); },
    logProbabilities(state) { return distribution(state.row.token); },
  };
  const decoder = new V10Decoder(reader, meta, 1, 16);
  const [facts, score] = decoder.generate(['@0', '@1'], 1)[0];
  assert.equal(facts, 'ask @0 @1');
  assert.ok(Number.isFinite(score) && Math.abs(score) < 1e-5, `unexpected score: ${score}`);
  assert.equal(decoder.lastMetrics.prefillRows, 4);
  assert.equal(decoder.lastMetrics.decodeRows, 4);
  assert.equal(decoder.lastMetrics.decodeSteps, 5);
  assert.ok(decoder.lastMetrics.prefillMs >= 0);
  assert.ok(decoder.lastMetrics.forwardMs >= 0);
  assert.ok(decoder.lastMetrics.probabilityMs >= 0);
  assert.ok(decoder.lastMetrics.decoderMs >= decoder.lastMetrics.prefillMs);
});

let v10 = null;   // one real-model runtime shared by the tests below
const loadV10 = () => v10 ??= (async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const release = JSON.parse(await readFile(path.join(root, 'public/model-release.json'), 'utf8'));
  const model = release.model;
  const modelDir = path.join(root, 'public/m', model.contentHash);
  const runtimeDir = path.join(root, 'public/r', release.runtimeHash);
  const { initializeV10, askV10 } = await import(pathToFileURL(path.join(runtimeDir, 'v10-pipeline.js')).href);
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
  const ready = await initializeV10({ model, ctx: {}, getFile, weightsResponse, engine: 'mt', deviceTier: 'high', maxThreads: 4 });
  return { ready, askV10 };
})();

test('v10-r8p Pyodide answer path solves a three-link story with threaded reader', async () => {
  const { ready, askV10 } = await loadV10();
  const { result } = askV10("Arvind's daughter Leena was there. Arvind's sister is Meera. Meera's son is Kabir.", 'Leena', 'Kabir');
  assert.equal(result.relation, 'paternal cousin');
  assert.equal(result.status, 'assumed');
  assert.ok(result.forwardMs > 0 && result.forwardMs < result.ms);
  assert.ok(ready.threads >= 1 && ready.threads <= 4);
});

// The Workbench input: the pasted text as written, so kinlogic.exam maps the answer onto the options (eval.run_real's
// input). The v8 rewording loses this question's only fact, which shares the question's sentence.
test('v10-r8p reads a pasted exam question with its options and picks the option', async () => {
  const { askV10 } = await loadV10();
  const text = "If Umesh's child is Utkarsh, then how is Utkarsh related to Umesh? (1) Wife (2) Son-in-law (3) Brother (4) Son";
  const input = readerInput(text, 'Umesh', 'Utkarsh');
  assert.deepEqual(input, { text, asked: true });
  const { result } = askV10(input.text, 'Umesh', 'Utkarsh', [], { asked: input.asked });
  assert.equal(result.relation, 'son');
  assert.equal(result.option, '4');
  assert.ok(result.decodeCalls >= 1);   // read by the model, not only the exact rules
});

test('v10-r8p reports a chosen "cannot be determined" option as no established relation', async () => {
  const { askV10 } = await loadV10();
  const text = 'A is the brother of B. How is B related to A? (a) Brother (b) Sister (c) Cannot be determined (d) Father';
  const { result } = askV10(text, 'A', 'B', [], { asked: true });   // B's gender is never given
  assert.equal(result.option, 'c');
  assert.equal(result.kind, 'unknown');
  assert.equal(result.relation, null);
});

test('v10-r8p asks the picker\'s question when the text\'s own question is about the other direction', async () => {
  const { askV10 } = await loadV10();
  const text = 'The husband of the mother of Padma is Adam. Adam is the ____ of Padma.';
  assert.equal(askV10(text, 'Padma', 'Adam', [], { asked: true }).result.relation, 'father');   // its own question
  assert.equal(askV10(text, 'Adam', 'Padma', [], { asked: true }).result.relation, 'daughter');   // read again, picker's
});
