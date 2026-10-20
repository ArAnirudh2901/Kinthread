// Kinship arithmetic for explaining an answer the way a student works it out on paper:
// combine two relations at a time ("father's wife is mother"), keep track of generations and genders.
// Only combinations with one clear answer are composed; anything ambiguous (a daughter's father could be
// your husband or you) or outside the 18 answers (cousin, sister-in-law) is left as a chain of words.
// Unit-tested in tests/relations.test.mjs.

// relation word -> [kind, gender of the relative]
export const RELATION = {
  father: ['parent', 'm'], mother: ['parent', 'f'],
  son: ['child', 'm'], daughter: ['child', 'f'],
  brother: ['sibling', 'm'], sister: ['sibling', 'f'],
  husband: ['spouse', 'm'], wife: ['spouse', 'f'],
  grandfather: ['grandparent', 'm'], grandmother: ['grandparent', 'f'],
  grandson: ['grandchild', 'm'], granddaughter: ['grandchild', 'f'],
  uncle: ['auncle', 'm'], aunt: ['auncle', 'f'],
  nephew: ['nibling', 'm'], niece: ['nibling', 'f'],
  'father-in-law': ['parentInLaw', 'm'], 'mother-in-law': ['parentInLaw', 'f'],
  'son-in-law': ['childInLaw', 'm'], 'daughter-in-law': ['childInLaw', 'f'],
};

// generations above (+) or below (-) the reference person
export const GENERATION = {
  parent: 1, child: -1, sibling: 0, spouse: 0, grandparent: 2, grandchild: -2,
  auncle: 1, nibling: -1, parentInLaw: 1, childInLaw: -1,
};

const WORD = {
  siblingInLaw: { m: 'brother-in-law', f: 'sister-in-law' }, cousin: { m: 'cousin', f: 'cousin' },
  parent: { m: 'father', f: 'mother' }, child: { m: 'son', f: 'daughter' },
  sibling: { m: 'brother', f: 'sister' }, spouse: { m: 'husband', f: 'wife' },
  grandparent: { m: 'grandfather', f: 'grandmother' }, grandchild: { m: 'grandson', f: 'granddaughter' },
  auncle: { m: 'uncle', f: 'aunt' }, nibling: { m: 'nephew', f: 'niece' },
  parentInLaw: { m: 'father-in-law', f: 'mother-in-law' }, childInLaw: { m: 'son-in-law', f: 'daughter-in-law' },
};

// X -first-> Y -second-> Z  =>  Z's kind relative to X (one clear answer only)
const COMPOSE = {
  'parent|parent': 'grandparent',
  'parent|sibling': 'auncle',
  'parent|spouse': 'parent',          // father's wife is mother
  'parent|child': 'sibling',          // mother's son (another person) is brother
  'child|child': 'grandchild',
  'child|sibling': 'child',           // daughter's brother is son
  'child|spouse': 'childInLaw',
  'childInLaw|spouse': 'child',
  'childInLaw|child': 'grandchild',
  'sibling|sibling': 'sibling',
  'sibling|parent': 'parent',
  'sibling|grandparent': 'grandparent',
  'sibling|child': 'nibling',
  'spouse|child': 'child',
  'spouse|parent': 'parentInLaw',
  'spouse|grandchild': 'grandchild',
  'grandparent|spouse': 'grandparent',
  'grandchild|sibling': 'grandchild',
  'auncle|sibling': 'auncle',
  'nibling|sibling': 'nibling',
  'parentInLaw|spouse': 'parentInLaw',
  'child|parent': 'spouse',           // a daughter's other parent (not you) is your husband or wife
  'sibling|auncle': 'auncle',
  'sibling|spouse': 'siblingInLaw',
  'spouse|sibling': 'siblingInLaw',
  'siblingInLaw|parent': 'parentInLaw',
  'siblingInLaw|child': 'nibling',
  'auncle|child': 'cousin',
  'cousin|sibling': 'cousin',
  'cousin|grandparent': 'grandparent',
};

// true in the usual case, with another possibility a student should know about
const USUALLY = {
  'child|auncle': ['sibling', 'it could also be an in-law'],          // daughter's uncle: your brother (or brother-in-law)
  'child|grandparent': ['parent', 'it could also be your father- or mother-in-law'],
  'nibling|auncle': ['sibling', 'it could also be an in-law'],
  'auncle|parent': ['grandparent', 'unless the uncle or aunt is related by marriage'],
  'nibling|grandparent': ['parent', 'it could also be an in-law'],
  'grandchild|auncle': ['child', 'it could also be a son- or daughter-in-law'],
  'cousin|parent': ['auncle', 'it could also be an aunt or uncle by marriage'],
};

export const kindOf = (word) => RELATION[word]?.[0] ?? null;
export const genderOf = (word) => RELATION[word]?.[1] ?? null;
export const wordFor = (kind, gender) => (kind && gender ? WORD[kind]?.[gender] ?? null : null);

/**
 * Work through a chain of relation words from A.
 * Returns one entry per step: { kind, word } (the combined relation so far, null when no single
 * answer exists) and { phrase } ("daughter's brother", always true as words).
 */
export function deduce(words) {
  const out = [];
  let kind = null;
  let open = true;   // false once a combination has no single answer
  words.forEach((w, i) => {
    const k = kindOf(w), g = genderOf(w);
    let note = null;
    if (i === 0) kind = k;
    else if (open && kind && k) {
      const key = `${kind}|${k}`;
      if (has(COMPOSE, key)) kind = COMPOSE[key];
      else if (has(USUALLY, key)) [kind, note] = USUALLY[key];
      else kind = null;
    } else kind = null;
    if (!kind) open = false;
    out.push({ kind, word: open ? wordFor(kind, g) : null, note: open ? note : null, phrase: words.slice(0, i + 1).join('\u2019s ') });
  });
  return out;
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // Object.hasOwn: Safari < 15.4

/** Generation of every person on the path, A at 0. Unknown words keep the same generation. */
export function generations(words) {
  const g = [0];
  for (const w of words) g.push(g[g.length - 1] + (GENERATION[kindOf(w)] ?? 0));
  return g;
}

/** Gender of every person on the path: known for everyone except A (unless nothing says). */
export function genders(words, answer) {
  const out = [null, ...words.map(genderOf)];
  if (answer && genderOf(answer)) out[out.length - 1] = genderOf(answer);
  return out;
}

export const generationName = (delta, name) => ({
  2: 'Grandparents', 1: 'Parents', 0: `${name}’s generation`, [-1]: 'Children', [-2]: 'Grandchildren',
})[delta] ?? (delta > 0 ? `${delta} generations up` : `${-delta} generations down`);

/** The story sentence a fact most likely came from: the first one naming both people. */
export function evidence(story, from, to) {
  const parts = story.trim().split(/([.!?])\s+/);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) sentences.push((parts[i] + (parts[i + 1] || '')).trim());
  const has = (s, n) => new RegExp(`(^|[^\\p{L}\\p{N}_])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u').test(s);
  return sentences.find((s) => has(s, from) && has(s, to)) || null;
}
