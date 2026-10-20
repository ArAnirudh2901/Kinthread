// Worst-case data for the dev-only data toggle (?data=…). Realistic, never random: long hyphenated and accented names,
// a two-letter name, exam letters with a pasted question, the empty and one-person cases, the people and word limits.
import { MAX_PEOPLE, WORD_LIMIT } from './story.js';

const names = ['Ava', 'Ben', 'Cara', 'Dev', 'Esme', 'Farid', 'Gita', 'Hugo', 'Ines', 'Jon', 'Kenji', 'Lena', 'Mateo', 'Nora', 'Omar', 'Pia',
  'Quinn', 'Rosa', 'Sami', 'Tara', 'Uma', 'Vik', 'Wen', 'Xavi', 'Yara', 'Zane', 'Abel', 'Bea', 'Cyrus', 'Dora', 'Eli', 'Fay'];
const chain = (n) => names.slice(0, n).slice(1).map((x, i) => `${names[i]}'s sibling ${x} came along.`).join(' ');
const long = () => {
  const base = "Victor asked his father George for advice. George's wife Helen made tea for them. Helen's daughter Rose joined them in the kitchen. ";
  let s = '';
  while ((s + base).split(/\s+/).length < WORD_LIMIT - 8) s += base;
  return s.trim();
};

export const FIXTURES = {
  worst: { story: "Maximiliana's son Bartholomew-Fitzgerald visited on Sunday. Bartholomew-Fitzgerald's daughter Jo painted a picture. Jo's brother Christopherson helped her. How is Christopherson related to Maximiliana?", a: 'Maximiliana', b: 'Christopherson' },
  exam: { story: 'P is the son of Q. Q is the wife of R. R is the father of S. How is P related to S? (a) Brother (b) Uncle (c) Son (d) Father', a: 'S', b: 'P' },
  one: { story: 'Ashley walked to the market alone.', a: null, b: null },
  many: { story: chain(MAX_PEOPLE), a: names[0], b: names[3] },
  long: { story: long(), a: 'Victor', b: 'Rose' },
  empty: { story: '', a: null, b: null },
};
