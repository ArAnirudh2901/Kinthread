// Exam-style blood-relation questions ("A is the brother of B. C is the father of A. How is C related
// to B?"), shaped so the model can read them. The user's text is never changed: these only decide what
// the model and the name finder see. Checked against the real model in tests/exam.test.mjs.

const REL = [
  'father-in-law', 'mother-in-law', 'son-in-law', 'daughter-in-law', 'grandfather', 'grandmother', 'grandson',
  'granddaughter', 'father', 'mother', 'son', 'daughter', 'brother', 'sister', 'husband', 'wife', 'uncle', 'aunt',
  'nephew', 'niece',
].join('|');
const NAME = "[A-Z][A-Za-z]*";

// "How is D related to A?" and the usual exam variants; group 1 is B (the person described), group 2 is A
const QUESTIONS = [
  new RegExp(`[Hh]ow is (${NAME}) related (?:to|with) (${NAME})`),
  new RegExp(`[Hh]ow (${NAME}) is related (?:to|with) (${NAME})`),
  new RegExp(`(${NAME}) is related (?:to|with) (${NAME}) (?:as|how)\\b`),
  new RegExp(`[Ww]hat is the relation(?:ship)? of (${NAME}) (?:to|with) (${NAME})`),
  new RegExp(`(?:[Ww]hat|[Ww]ho) is (${NAME}) to (${NAME})\\s*\\?`),
];
// answer options pasted after the question: "(a) Uncle (b) Father", "a) …", "1. …"
const OPTIONS = /^\s*\(?[a-eA-E1-5][).]\s*\S/;

/** Finds the question in pasted text. Returns the story without it, and who it asks about. */
export function splitQuestion(text) {
  for (const re of QUESTIONS) {
    const m = re.exec(text);
    if (!m) continue;
    const b = m[1], a = m[2];
    if (b === a || /^(How|What|Who)$/.test(b)) continue;
    // the whole sentence the question sits in
    const start = Math.max(text.lastIndexOf('.', m.index), text.lastIndexOf('?', m.index), text.lastIndexOf('!', m.index), text.lastIndexOf('\n', m.index)) + 1;
    const q = text.indexOf('?', m.index + m[0].length - 1);
    let end = q < 0 ? text.length : q + 1;
    if (OPTIONS.test(text.slice(end))) end = text.length;   // drop multiple-choice options too
    const story = (text.slice(0, start) + ' ' + text.slice(end)).replace(/\s+/g, ' ').trim();
    return { story, a, b, question: text.slice(start, end).trim() };
  }
  return { story: text, a: null, b: null, question: null };
}

/** Single capital letters used as people ("A is the brother of B"), which the name model skips. */
export function letterNames(text) {
  const out = new Set();
  // before a verb, possessive or punctuation, or after "of/to/and…"; "I" is never a name here and "A man" is
  // an article. No lookbehind: Safari before 16.4 cannot parse it.
  const before = /(^|[^A-Za-z'’])([A-HJ-Z])(?![A-Za-z])(?=\s*(?:['’]s\b|\s(?:is|was|has|had|and|are|were)\b|[,.?!;]|$))/g;
  const after = /\b(?:of|to|and|with|than)\s([A-HJ-Z])(?![A-Za-z'’])/g;
  for (const m of text.matchAll(before)) out.add(m[2]);
  for (const m of text.matchAll(after)) out.add(m[1]);
  return [...out].sort((x, y) => text.indexOf(x) - text.indexOf(y));
}

/** "Anil is the son of Kamla" reads to the model as "Kamla's son Anil was there", the phrasing it learned. */
export function forModel(text) {
  const re = new RegExp(`\\b(${NAME}) (?:is|was) (?:the|a|an) (?:only )?(${REL}) of (${NAME})\\b(?!['’]s)`, 'g');
  return text.replace(re, "$3's $2 $1 was there");
}

/** Spoken-clue puzzles ("Pointing to a photo, A said…") need reasoning about the speaker; not supported. */
export const spokenClue = (text) => /\b[Pp]ointing (?:to|at|towards)\b|\b[Ii]ntroducing\b/.test(text);

/** Everything the model needs from what the user typed. */
export function prepare(text) {
  const { story, a, b } = splitQuestion(text);
  return { plain: story, model: forModel(story), letters: letterNames(story), a, b };
}
