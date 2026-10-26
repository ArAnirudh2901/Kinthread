import { ReaderWasm } from './reader.js';
import { V10Decoder } from './v10-decoder.js';

let reader;
let decoder;
let py;
let beam = 4;
let telemetry = null;

const jsonFile = async (entry, getFile, ctx) => JSON.parse(new TextDecoder().decode(await getFile(entry.json, ctx)));

export async function initializeV10({ model, ctx, getFile, weightsResponse, engine = 'auto', deviceTier = 'high', maxThreads = 1 }) {
  beam = deviceTier === 'low' ? 4 : deviceTier === 'balanced' ? 8 : 16;
  const threaded = engine === 'mt' || (engine === 'auto' && deviceTier !== 'low' && maxThreads > 1
    && (globalThis.navigator?.deviceMemory || 0) >= 8 && globalThis.crossOriginIsolated === true);
  const readerEngine = threaded ? 'mt' : engine === 'single' ? 'scalar' : engine;
  const [meta, verifier, final, names, logic] = await Promise.all([
    jsonFile(model.files.reader, getFile, ctx),
    jsonFile(model.files.verifier, getFile, ctx),
    jsonFile(model.files.final, getFile, ctx),
    getFile(model.files.nameTable.json, ctx),
    getFile(model.files.logic.json, ctx),
  ]);
  const gzStream = weightsResponse(model.files.reader, ctx).body.pipeThrough(new DecompressionStream('gzip'));
  reader = await ReaderWasm.loadStream(meta, gzStream, readerEngine);
  const threads = threaded ? reader.setThreads(maxThreads) : 1;
  decoder = new V10Decoder(reader, meta, beam, 96);
  const { loadPyodide } = await import('./pyodide/pyodide.mjs');
  const pyodideURL = new URL('./pyodide/', import.meta.url);
  const indexURL = typeof globalThis.process?.versions?.node === 'string'
    ? (await import('node:url')).fileURLToPath(pyodideURL)
    : pyodideURL.href;
  py = await loadPyodide({ indexURL });
  const fs = py.FS;
  fs.mkdirTree('/model');
  fs.mkdirTree('/python');
  fs.writeFile('/model/verifier.json', JSON.stringify(verifier));
  fs.writeFile('/model/final.json', JSON.stringify(final));
  fs.writeFile('/model/name_table.tsv.gz', names);
  fs.writeFile('/kinlogic.zip', logic);
  await py.runPythonAsync(`
import json, os, sys, zipfile
with zipfile.ZipFile('/kinlogic.zip') as z:
    z.extractall('/python')
sys.path.insert(0, '/python')
os.environ['KIN_NAME_MODEL'] = '/model/name-model.pt'
os.environ['KIN_VERIFIER'] = '/model/verifier.json'
os.environ['KIN_COVER'] = '1'
from kinlogic.prepare import prepare
from kinlogic.exam import answer, with_split_search, with_exact_clauses
from kinlogic.engine import solve
from kinlogic.facts import parse
from kinlogic.names import name_priors
from kinlogic import exam
exam.COVER = True

def _read(batch):
    return json.loads(str(read_js(json.dumps(batch, separators=(',', ':')))))

def kinthread_detect(text, extra_json):
    p = prepare(text, names=json.loads(extra_json))
    return json.dumps({'people': [e['text'] for e in p['ents']], 'tokens': len(p['tokens']), 'prepared': p['tokens'],
                       'entities': p['ents']}, separators=(',', ':'))

def kinthread_solve(text, extra_json):
    extra = json.loads(extra_json)
    p = prepare(text, names=extra)
    priors = name_priors(p['ents'])
    read = with_exact_clauses(with_split_search(_read))
    r = answer(text, read, priors=priors)
    stmts, _ = parse(r.get('facts') or '')
    people = list(dict.fromkeys(t for t in p['tokens'] if t.startswith('@')))
    solved = solve(stmts, people=people, priors=priors)
    q = solved['questions'][-1] if solved.get('questions') else None
    selected = None
    if q and q['answers']:
        selected = next((a for a in q['answers'] if a.get('label') == r.get('answer') or a.get('key') == r.get('answer')), q['answers'][0])
    labels = {e['id']: e['text'] for e in p['ents']}
    steps = []
    if selected and q and q['q'].get('t') == 'ask' and selected.get('moves'):
        world = selected['world']
        roots = {world.find(node): ent for ent, node in solved['ids'].items() if ent in labels}
        source = q['q']['x']
        from_name = labels.get(source, source)
        anonymous = 32
        word = {'U': {'M': 'father', 'F': 'mother', None: 'parent'},
                'D': {'M': 'son', 'F': 'daughter', None: 'child'},
                'S': {'M': 'husband', 'F': 'wife', None: 'spouse'},
                'B': {'M': 'brother', 'F': 'sister', None: 'sibling'}}
        for move, gender, node in selected['moves']:
            root = world.find(node)
            target = roots.get(root)
            if target is None:
                target = f'@{anonymous}'
                anonymous += 1
            steps.append(f"{from_name} {word[move].get(gender, word[move][None])} {labels.get(target, target)}")
            from_name = labels.get(target, target)
    fact_edges = [{'from': s['x'], 'to': s['y'], 'relation': s['r']} for s in stmts
                  if s.get('t') == 'rel' and 'claim' not in s and 'part' not in s]
    result = {'answer': r.get('answer'), 'status': r.get('status'), 'confidence': r.get('confidence', 0.0),
              'facts': r.get('facts', ''), 'explanation': r.get('explanation', ''), 'steps': steps,
              'people': [e['text'] for e in p['ents']], 'prepared': p['tokens'], 'entities': p['ents'],
              'traceFacts': [s.strip() for s in (r.get('facts') or '').split(';') if s.strip() and not s.strip().startswith('ask ')],
              'factEdges': fact_edges}
    return json.dumps(result, separators=(',', ':'))
`);
  py.globals.set('read_js', (batchJson) => {
    const batch = JSON.parse(String(batchJson));
    return JSON.stringify(batch.map((tokens) => {
      const candidates = decoder.generate(tokens, beam);
      if (telemetry) {
        const m = decoder.lastMetrics || {};
        telemetry.decodeCalls++;
        telemetry.promptTokens += m.promptTokens || 0;
        telemetry.prefillRows += m.prefillRows || 0;
        telemetry.decodeRows += m.decodeRows || 0;
        telemetry.decodeSteps += m.decodeSteps || 0;
        telemetry.prefillMs += m.prefillMs || 0;
        telemetry.forwardMs += m.forwardMs || 0;
        telemetry.probabilityMs += m.probabilityMs || 0;
        telemetry.decoderMs += m.decoderMs || 0;
      }
      return candidates;
    }));
  });
  return { engine: reader.engine, threads, tile: null, gunzip: 'stream', beam };
}

const callPython = (name, text, extra) => {
  if (!py) throw new Error('The v10 reasoning runtime is not ready.');
  py.globals.set('kt_text', text);
  py.globals.set('kt_extra', JSON.stringify(extra));
  const result = py.runPython(`${name}(kt_text, kt_extra)`);
  try { return JSON.parse(result.toString()); }
  finally { result.destroy?.(); }
};

export function detectV10(story, extra = []) {
  const result = callPython('kinthread_detect', story, extra);
  const people = [...new Set([...result.people, ...extra])];
  return { people, found: result.people, tokens: result.tokens };
}

export function askV10(story, a, b, extra = []) {
  const t0 = performance.now();
  const question = `${story.trim()}${story.trim() ? ' ' : ''}How is ${b} related to ${a}?`;
  telemetry = { decodeCalls: 0, promptTokens: 0, prefillRows: 0, decodeRows: 0, decodeSteps: 0,
    prefillMs: 0, forwardMs: 0, probabilityMs: 0, decoderMs: 0 };
  let r;
  try { r = callPython('kinthread_solve', question, extra); }
  catch (error) { telemetry = null; throw error; }
  const metrics = telemetry;
  telemetry = null;
  const inferenceMs = performance.now() - t0;
  const low = ['none', 'unrelated', 'contradiction'].includes(r.status) || /^not related\b/i.test(r.answer || '');
  const relation = low ? null : r.answer;
  const kind = low ? 'unknown' : r.status === 'unique' && r.confidence >= 0.7 ? 'answer' : 'not sure';
  const entities = Object.fromEntries((r.entities || []).map((e) => [e.id, e.text]));
  const mapNames = (text) => text.split(/\s+/).map((t) => entities[t] || t).join(' ');
  const trace = { tokens: (r.prepared || []).map((t) => entities[t] || t), entities,
    chain: (r.traceFacts || []).map(mapNames) };
  const factEdges = (r.factEdges || []).map(({ from, to, relation: rel }) => ({
    from: entities[from] || from, to: entities[to] || to, relation: rel,
  }));
  const result = { kind, relation, status: r.status, confidence: r.confidence || 0, steps: r.steps || [], share: r.confidence || 0,
    pUnknown: low ? 1 : 1 - (r.confidence || 0), pStart: low ? 1 : 1 - (r.confidence || 0),
    pLink: low ? 0 : r.confidence || 0, views: 1, beam, promptTokens: metrics.promptTokens,
    forwardRows: metrics.prefillRows + metrics.decodeRows, decodeRows: metrics.decodeRows,
    decodeSteps: metrics.decodeSteps, decodeCalls: metrics.decodeCalls, prefillMs: metrics.prefillMs,
    forwardMs: metrics.forwardMs, probabilityMs: metrics.probabilityMs, decoderMs: metrics.decoderMs,
    pipelineMs: Math.max(0, inferenceMs - metrics.decoderMs), factEdges,
    people: r.people || [], text: r.answer || r.explanation || 'The model could not answer this question.', ms: inferenceMs };
  return { result, trace };
}
