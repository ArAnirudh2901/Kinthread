// Contradictions stated in the story, and shared-question links.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contradictions, facts } from '../src/lib/consistency.js';
import { readShare, shareHash } from '../src/lib/share.js';

test('reads plain family facts', () => {
  assert.deepEqual(facts("Ashley's daughter, Lillian, asked her mom. Nicholas's sister Lillian helped."),
    [{ owner: 'Ashley', word: 'daughter', person: 'Lillian' }, { owner: 'Nicholas', word: 'sister', person: 'Lillian' }]);
  assert.deepEqual(facts('A is the brother of B. Suresh is Ravi\'s father.'),
    [{ owner: 'B', word: 'brother', person: 'A' }, { owner: 'Ravi', word: 'father', person: 'Suresh' }]);
});

test('flags a person called both male and female', () => {
  const i = contradictions("Ashley's son, Lillian, asked her mom. Nicholas's sister Lillian asked him for help.");
  assert.equal(i.length, 1);
  assert.equal(i[0].kind, 'gender');
  assert.match(i[0].message, /Lillian is called both a son and a sister/);
});

test('flags self relations and parent cycles', () => {
  assert.equal(contradictions("Ashley's son Ashley ran.")[0].kind, 'self');
  const c = contradictions('A is the father of B. B is the father of A.');
  assert.ok(c.some((x) => x.kind === 'cycle'));
});

test('consistent stories and examples raise nothing', () => {
  for (const s of [
    "Ashley's daughter, Lillian, asked her mom to read her a story. Nicholas's sister Lillian asked him for some help.",
    "Victor asked his father George for advice. George's wife Helen made tea for them. Helen's daughter Rose joined them.",
    'A is the brother of B. C is the father of A. How is C related to B?',
    'P is the son of Q. Q is the wife of R. R is the father of S. How is P related to S?',
  ]) assert.deepEqual(contradictions(s), [], s);
});

test('share links round-trip and reject bad input', () => {
  const q = { story: "Ashley's son Tom & Mary's cat.", a: 'Ashley', b: 'Tom' };
  assert.deepEqual(readShare(shareHash(q)), q);
  assert.equal(readShare('#story=' + 'x'.repeat(7000)), null);
  assert.equal(readShare('#nothing=1'), null);
  assert.deepEqual(readShare(shareHash({ story: 'Ann met Bo.', a: 'Zed', b: 'Bo' })), { story: 'Ann met Bo.', a: null, b: 'Bo' });
});
