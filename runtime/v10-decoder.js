// v10 BPE tokenizer, grammar-constrained beam search, and WASM decode loop.
const SPECIAL = { bos: 2, cont: 3, eos: 5, sep: 4 };
const join = (a, b) => a + b.slice(2);
const render = (written) => written.join(' ').replace(/(?: ;)+$/, '');

export class V10Decoder {
  constructor(reader, meta, width = 8, maxNew = 96) {
    this.reader = reader;
    this.meta = meta;
    this.width = width;
    this.maxNew = maxNew;
    this.stoi = new Map(meta.vocab.map((t, i) => [t, i]));
    this.rank = new Map(meta.merges.map(([a, b], i) => [`${a}\0${b}`, i]));
    this.g = meta.grammar;
    this.sided = [...this.g.sided].sort();
    this.only = [...this.g.only].sort();
    this.starters = [...this.g.questions, ...this.g.puzzle, ...this.g.groups, ...this.g.roles, 'prof'];
    this.afterEntity = ['not', 'only', ...this.g.sides, ...this.g.relations, 'male', 'female', ...this.g.attributes, 'opposite', 'same', 'has', 'gen', 'prof'];
    this.pair = ['male', 'female', 'couple', ...this.g.kin];
    this.numbers = this.g.numbers;
    this.nextSlot = 0;
  }

  word(token) {
    const found = this.stoi.get(token);
    if (found !== undefined || !this.meta.merges?.length || /^[#@<]/.test(token)) return [found ?? 1];
    let symbols = [...token].map((c, i) => i ? `##${c}` : `▁${c}`);
    while (symbols.length > 1) {
      let best = -1, rank = Infinity;
      for (let i = 0; i + 1 < symbols.length; i++) {
        const r = this.rank.get(`${symbols[i]}\0${symbols[i + 1]}`) ?? Infinity;
        if (r < rank) { best = i; rank = r; }
      }
      if (best < 0) break;
      symbols.splice(best, 2, join(symbols[best], symbols[best + 1]));
    }
    return symbols.map((s) => this.stoi.get(s) ?? 1);
  }

  encode(tokens) {
    const spare = ['¤', '§', '•', '☆', '∆', '¥', '€'].filter((s) => !tokens.includes(s));
    const symbols = new Map();
    for (const t of ['@', '#']) if (tokens.includes(t)) symbols.set(t, spare.shift());
    return tokens.flatMap((t) => this.word(symbols.get(t) || t));
  }

  allowed(written, entities) {
    let newCount = 0;
    for (const t of written) if (t[0] === '#') newCount = Math.max(newCount, Number(t.slice(1)) || 0);
    const people = [...entities, ...Array.from({ length: newCount }, (_, i) => `#${i + 1}`)];
    if (newCount < this.g.maxNew) people.push(`#${newCount + 1}`);
    const other = (x) => people.filter((p) => p !== x);
    const cur = [];
    for (const t of written) { if (t === ';') cur.length = 0; else cur.push(t); }
    const eos = (xs) => xs.includes(';') ? [...xs, '<eos>'] : xs;
    if (!cur.length) return [...people, ...this.starters, '<eos>'];
    const [a] = cur, n = cur.length, last = cur.at(-1);
    const sided = (i, kinOnly = false) => n === i ? [...this.g.sides, ...this.g.relations.filter((r) => !kinOnly || this.g.kin.includes(r))]
      : n === i + 1 && this.g.sides.includes(cur[i]) ? this.sided.filter((r) => !kinOnly || this.g.kin.includes(r)) : [';'];
    if (a === 'ask') return n === 1 ? people : n === 2 ? other(cur[1]) : [';'];
    if (a === 'prof') return n === 1 ? people : [';'];
    if (a === 'who') return n >= 2 && cur[1] === 'prof' ? (n === 2 ? this.g.profs : [';']) : n === 1 ? [...people, 'prof'] : sided(2);
    if (a === 'count') return n === 1 ? [...this.g.countable, ...people] : this.g.countable.includes(cur[1]) ? [';'] : sided(2, true);
    if (a === 'gender') return n === 1 ? people : [';'];
    if (a === 'pair') return n === 1 ? this.pair : [';'];
    if ([...this.g.puzzle, ...this.g.groups, ...this.g.roles].includes(a)) return n === 1 ? this.numbers.slice(1) : [';'];
    if (n === 1) return this.afterEntity;
    if (cur[1] === 'has') return n === 2 ? this.numbers : sided(3, true);
    if (cur[1] === 'gen') return n === 2 ? this.numbers.slice(1, 6) : [';'];
    if (cur[1] === 'prof') return n === 2 ? this.g.profs : [';'];
    if (['male', 'female', ...this.g.attributes].includes(last)) return [';'];
    if (last === 'opposite' || last === 'same') return other(a);
    if (last === 'not') return ['only', ...this.g.sides, ...this.g.relations];
    if (last === 'only') return [...this.g.sides, ...this.only];
    if (this.g.sides.includes(last)) return this.sided;
    if (this.g.kin.includes(last) || this.g.nonkin.includes(last)) return [...other(a), 'of'];
    if (last === 'of') return other(a);
    return [';'];
  }

  generate(tokens, k = this.width) {
    const ids = [SPECIAL.bos, ...this.encode(tokens), SPECIAL.cont];
    const metrics = { promptTokens: ids.length, prefillRows: ids.length, decodeRows: 0, decodeSteps: 0,
      prefillMs: 0, forwardMs: 0, probabilityMs: 0, decoderMs: 0 };
    const prefillStart = performance.now();
    const pre = this.reader.prefill(ids, this.maxNew);
    metrics.prefillMs = performance.now() - prefillStart;
    const P = pre.prefixLength;
    this.nextSlot = P;
    const entities = [...new Set(tokens.filter((t) => t.startsWith('@') && this.stoi.has(t)))];
    let hyps = [{ written: [], score: 0, n: 0, slots: [], probs: pre.logprobs }];
    const finished = [];
    for (let step = 0; step < this.maxNew && hyps.length; step++) {
      metrics.decodeSteps++;
      const candidates = [];
      for (let h = 0; h < hyps.length; h++) {
        const allowed = this.allowed(hyps[h].written, entities)
          .map((t) => [t, this.stoi.get(t === ';' ? '<sep>' : t)])
          .filter(([, id]) => id !== undefined);
        if (!allowed.length) continue;
        const logs = allowed.map(([, id]) => hyps[h].probs[id]);
        const max = Math.max(...logs), z = max + Math.log(logs.reduce((s, x) => s + Math.exp(x - max), 0));
        for (let i = 0; i < allowed.length; i++) candidates.push({ parent: h, token: allowed[i][1], text: allowed[i][0], score: hyps[h].score + logs[i] - z });
      }
      candidates.sort((a, b) => b.score - a.score);
      const keep = candidates.slice(0, k), children = [];
      for (const c of keep) {
        const parent = hyps[c.parent], count = parent.n + 1;
        if (c.token === SPECIAL.eos || step === this.maxNew - 1) {
          finished.push([render(parent.written), c.score / count]);
          continue;
        }
        const slot = this.nextSlot++;
        children.push({ written: [...parent.written, c.text === '<sep>' ? ';' : c.text], score: c.score,
          n: count, slots: [...parent.slots, slot], token: c.token, slot, position: P + parent.n,
          context: [...Array(P).keys(), ...parent.slots] });
      }
      if (!children.length) break;
      const rows = children.map((h) => ({ token: h.token, position: h.position, slot: h.slot, context: h.context }));
      const forwardStart = performance.now();
      const states = this.reader.forward(rows, { copyKeys: false });
      metrics.forwardMs += performance.now() - forwardStart;
      metrics.decodeRows += rows.length;
      const probabilityStart = performance.now();
      for (let i = 0; i < children.length; i++) children[i].probs = this.reader.logProbabilities(states[i], pre.promptKeys, pre.promptIds);
      metrics.probabilityMs += performance.now() - probabilityStart;
      hyps = children;
    }
    const best = new Map();
    for (const [text, score] of finished) if (!best.has(text) || score > best.get(text)) best.set(text, score);
    metrics.decoderMs = performance.now() - prefillStart;
    this.lastMetrics = metrics;
    return [...best].sort((a, b) => b[1] - a[1]).slice(0, k);
  }
}
