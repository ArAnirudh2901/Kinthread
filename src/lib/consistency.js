// Contradictions a story states outright: one person called both male and female, someone listed as their own
// relative, two people each the other's parent. Read from plain facts in the text ("X's son Y", "Y is the son of X",
// "Y is X's son"); pronouns and implications are left to the model.
import { RELATION, genderOf, kindOf } from './relations.js';
import { splitQuestion } from './exam.js';

const ALIAS = { mom: 'mother', mum: 'mother', dad: 'father', grandma: 'grandmother', grandpa: 'grandfather' };
const WORDS = [...Object.keys(RELATION), ...Object.keys(ALIAS)].sort((x, y) => y.length - x.length).join('|');
const NAME = "[A-Z][A-Za-z]*(?:-[A-Z][A-Za-z]*)?";
const NOT_NAMES = new Set(['He', 'She', 'His', 'Her', 'They', 'Their', 'The', 'It', 'How', 'What', 'Who']);

/** Family facts stated in the text, as { owner, word, person }: person is owner's word. */
export function facts(story) {
  const text = splitQuestion(story).story;
  const out = [];
  const push = (owner, word, person) => {
    if (NOT_NAMES.has(owner) || NOT_NAMES.has(person)) return;
    out.push({ owner, word: ALIAS[word.toLowerCase()] || word.toLowerCase(), person });
  };
  const poss = new RegExp(`\\b(${NAME})['’]s (?:only )?(${WORDS}),? (${NAME})\\b`, 'gi');
  const isOf = new RegExp(`\\b(${NAME}) (?:is|was) (?:the |a |an )?(?:only )?(${WORDS}) of (${NAME})\\b(?!['’]s)`, 'gi');
  const isPoss = new RegExp(`\\b(${NAME}) (?:is|was) (${NAME})['’]s (?:only )?(${WORDS})\\b`, 'gi');
  const cap = (m, i) => /^[A-Z]/.test(m[i]);   // names keep their capital even with the case-insensitive relation words
  for (const m of text.matchAll(poss)) if (cap(m, 1) && cap(m, 3)) push(m[1], m[2], m[3]);
  for (const m of text.matchAll(isOf)) if (cap(m, 1) && cap(m, 3)) push(m[3], m[2], m[1]);
  for (const m of text.matchAll(isPoss)) if (cap(m, 1) && cap(m, 2)) push(m[2], m[3], m[1]);
  return out;
}

/** Plain-language problems, each { kind, people, message }. Empty when the story is consistent as far as it says. */
export function contradictions(story) {
  const fs = facts(story);
  const issues = [];
  const said = new Map();   // person -> { m: word, f: word }
  const parents = new Set();   // "parent>child"
  for (const f of fs) {
    if (f.owner === f.person) {
      issues.push({ kind: 'self', people: [f.person], message: `${f.person} is described as their own ${f.word}.` });
      continue;
    }
    const g = genderOf(f.word);
    if (g) {
      const seen = said.get(f.person) || {};
      if (!seen[g]) seen[g] = f.word;
      said.set(f.person, seen);
    }
    const kind = kindOf(f.word);
    if (kind === 'parent') parents.add(`${f.person}>${f.owner}`);
    if (kind === 'child') parents.add(`${f.owner}>${f.person}`);
  }
  for (const [person, seen] of said) {
    if (seen.m && seen.f) {
      issues.push({ kind: 'gender', people: [person], message: `${person} is called both ${article(seen.m)} and ${article(seen.f)}. One person can't be both.` });
    }
  }
  for (const pair of parents) {
    const [p, c] = pair.split('>');
    if (p < c && parents.has(`${c}>${p}`)) issues.push({ kind: 'cycle', people: [p, c], message: `${p} and ${c} are each described as the other's parent.` });
  }
  return issues;
}

const article = (w) => `${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w}`;
