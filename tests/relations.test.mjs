// The deductions shown to students must be right: every composition is checked here.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deduce, evidence, genders, generations } from '../src/lib/relations.js';

const last = (words) => deduce(words).at(-1).word;

test('the five examples on the site deduce the model’s answers', () => {
  assert.equal(last(['daughter', 'brother']), 'son');                  // Ashley -> Nicholas
  assert.equal(last(['father', 'wife', 'daughter']), 'sister');         // Victor -> Rose
  assert.equal(last(['father', 'mother']), 'grandmother');              // Priya -> Kavya
});

test('textbook combinations', () => {
  const cases = [
    [['father', 'wife'], 'mother'], [['mother', 'husband'], 'father'],
    [['father', 'brother'], 'uncle'], [['mother', 'sister'], 'aunt'],
    [['brother', 'son'], 'nephew'], [['sister', 'daughter'], 'niece'],
    [['son', 'son'], 'grandson'], [['daughter', 'daughter'], 'granddaughter'],
    [['father', 'father'], 'grandfather'], [['mother', 'mother'], 'grandmother'],
    [['son', 'wife'], 'daughter-in-law'], [['daughter', 'husband'], 'son-in-law'],
    [['wife', 'father'], 'father-in-law'], [['husband', 'mother'], 'mother-in-law'],
    [['brother', 'sister'], 'sister'], [['sister', 'father'], 'father'],
    [['wife', 'son'], 'son'], [['husband', 'daughter'], 'daughter'],
    [['brother', 'son', 'sister'], 'niece'], [['son', 'sister'], 'daughter'],
    [['father', 'son'], 'brother'], [['mother', 'daughter'], 'sister'],
    [['grandfather', 'wife'], 'grandmother'], [['grandson', 'sister'], 'granddaughter'],
  ];
  for (const [words, want] of cases) assert.equal(last(words), want, words.join(' -> '));
});

test('ambiguous combinations stay as words, never a guess', () => {
  for (const words of [['grandfather', 'son'], ['grandson', 'mother'], ['father', 'grandfather']]) {
    const d = deduce(words).at(-1);
    assert.equal(d.word, null, words.join(' -> '));
    assert.equal(d.phrase, words.join('\u2019s '));
  }
  // once the chain loses its single answer it stays unknown
  assert.equal(last(['grandfather', 'son', 'wife']), null);
});

test('usual-case deductions carry a note; in-between relations are named', () => {
  const d = deduce(['daughter', 'uncle']).at(-1);
  assert.equal(d.word, 'brother');
  assert.match(d.note, /in-law/);
  assert.equal(last(['daughter', 'father']), 'husband');
  assert.equal(last(['wife', 'brother']), 'brother-in-law');
  assert.equal(last(['uncle', 'son']), 'cousin');
  assert.equal(last(['husband', 'sister', 'mother']), 'mother-in-law');
  assert.equal(last(['brother', 'wife', 'son', 'sister']), 'niece');
  assert.equal(deduce(['father', 'wife']).at(-1).note, null);
});

test('generations and genders follow the chain', () => {
  assert.deepEqual(generations(['father', 'wife', 'daughter']), [0, 1, 1, 0]);
  assert.deepEqual(generations(['daughter', 'brother']), [0, -1, -1]);
  assert.deepEqual(genders(['father', 'wife', 'daughter'], 'sister'), [null, 'm', 'f', 'f']);
});

test('evidence: the sentence that names both people', () => {
  const story = "Ashley's daughter, Lillian, asked her mom to read her a story. Nicholas's sister Lillian asked him for some help.";
  assert.equal(evidence(story, 'Ashley', 'Lillian'), "Ashley's daughter, Lillian, asked her mom to read her a story.");
  assert.equal(evidence(story, 'Lillian', 'Nicholas'), "Nicholas's sister Lillian asked him for some help.");
  assert.equal(evidence(story, 'Ashley', 'Nicholas'), null);
});
