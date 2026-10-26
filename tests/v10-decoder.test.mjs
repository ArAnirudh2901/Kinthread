import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { V10Decoder } from '../runtime/v10-decoder.js';

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

test('v10-r8p Pyodide answer path solves a three-link story with threaded reader', async () => {
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
  const { result } = askV10("Arvind's daughter Leena was there. Arvind's sister is Meera. Meera's son is Kabir.", 'Leena', 'Kabir');
  assert.equal(result.relation, 'paternal cousin');
  assert.equal(result.status, 'assumed');
  assert.ok(result.forwardMs > 0 && result.forwardMs < result.ms);
  assert.ok(ready.threads >= 1 && ready.threads <= 4);
});
