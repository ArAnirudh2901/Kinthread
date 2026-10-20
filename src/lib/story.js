// Pure helpers for stories, names and reasoning steps (no React, unit-tested in tests/story.test.mjs).

export const WORD_LIMIT = 280;

export const countWords = (text) => (text.match(/\S+/g) || []).length;

const LETTER = '\\p{L}\\p{N}_';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The story's own spelling of `name` when it appears there as a whole word, else null. */
export function findInStory(story, name) {
  const n = name.trim();
  if (!n || /\s/.test(n)) return null;
  // no lookbehind: Safari < 16.4 cannot parse it
  const m = new RegExp(`(^|[^${LETTER}])(${escapeRe(n)})(?![${LETTER}])`, 'iu').exec(story);
  return m ? m[2] : null;
}

/** Steps like "Ashley daughter Lillian" -> [{ from, rel, to }]. */
export function parseSteps(steps = []) {
  return steps.map((s) => {
    const w = s.trim().split(/\s+/);
    return { from: w[0], rel: w.slice(1, -1).join(' '), to: w[w.length - 1] };
  });
}

/**
 * Nodes and edges for the Threadline, exactly as the model returned them.
 * `linked` is false when the steps do not form one chain from a to b (then nothing is drawn as connected).
 */
export function buildPath(a, b, steps) {
  const parsed = parseSteps(steps);
  if (!parsed.length) return { nodes: [a, b], edges: [], linked: false };
  const nodes = [parsed[0].from, ...parsed.map((s) => s.to)];
  const linked = parsed[0].from === a && nodes[nodes.length - 1] === b &&
    parsed.every((s, i) => i === 0 || s.from === parsed[i - 1].to);
  return { nodes, edges: parsed.map((s) => s.rel), linked };
}

/** Entity tokens the model could not map back to a name ("@7") read as "someone". */
export const personLabel = (name) => (/^@\d+$/.test(name) ? 'someone' : name);

/** "Lillian is Ashley's daughter." */
export const stepSentence = ({ from, rel, to }) => `${personLabel(to)} is ${possessive(personLabel(from))} ${rel}.`;

export const possessive = (name) => `${name}\u2019s`;   // Chicago style: Nicholas\u2019s, James\u2019s

/** The relationship model has 32 entity ids (@0 to @31). */
export const MAX_PEOPLE = 32;

/** Keep a selection only while the person is still in the story. */
export const keepIf = (name, people) => (name && people.includes(name) ? name : null);

const PRONOUN_START = /^(he|she|his|her|him|they|their|them)\b/i;

/**
 * Who the story mentions together: people in the same sentence, or in a following sentence that starts
 * with a pronoun (the same grouping kinship.js uses to decide whether two people are connected at all).
 * These are text links, not family relations. Returns sorted unique pairs [a, b].
 */
export function mentionLinks(story, people) {
  if (!story || people.length < 2) return [];
  const parts = story.trim().split(/([.!?])\s+/);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) sentences.push(parts[i] + (parts[i + 1] || ''));
  const patterns = people.map((n) => [n, new RegExp(`(^|[^${LETTER}])${escapeRe(n)}(?![${LETTER}])`, 'u')]);
  const groups = [];
  let cur = [];
  for (const s of sentences) {
    if (cur.length && !PRONOUN_START.test(s.trim())) { groups.push(cur); cur = []; }
    for (const [n, re] of patterns) {
      const m = re.exec(s);
      if (m && !cur.some((c) => c.n === n)) cur.push({ n, at: m.index + m[1].length + groups.length * 1e6 });
    }
  }
  groups.push(cur);
  const seen = new Set(), out = [];
  for (const g of groups) {
    g.sort((x, y) => x.at - y.at);
    // neighbours in order of mention: a readable chain, not a hairball
    for (let i = 1; i < g.length; i++) {
      const pair = [g[i - 1].n, g[i].n].sort();
      const key = pair.join('\u0000');
      if (!seen.has(key)) { seen.add(key); out.push(pair); }
    }
  }
  return out;
}
