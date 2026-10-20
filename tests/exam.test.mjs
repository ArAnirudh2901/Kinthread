// Exam-style input: the question pulled out of pasted text, letters as names, "is the R of" rewritten.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forModel, letterNames, prepare, splitQuestion, spokenClue } from '../src/lib/exam.js';

test('finds the question and who it asks about', () => {
  const cases = [
    ['A is the brother of B. C is the father of A. How is C related to B?', 'C', 'B'],
    ['A is the brother of B. C is the father of A. How C is related to B?', 'C', 'B'],
    ['A is the brother of B. C is the father of A. C is related to B as?', 'C', 'B'],
    ['A is the brother of B. C is the father of A. What is C to B?', 'C', 'B'],
    ['Ravi is the brother of Meena. What is the relation of Suresh with Meena?', 'Suresh', 'Meena'],
  ];
  for (const [text, b, a] of cases) {
    const q = splitQuestion(text);
    assert.equal(q.b, b, text);
    assert.equal(q.a, a, text);
    assert.ok(!/related|What|How/.test(q.story), q.story);
  }
});

test('drops multiple-choice options, keeps story text after a question', () => {
  assert.equal(splitQuestion('A is the brother of B. How is A related to B? (a) Son (b) Brother (c) Uncle').story, 'A is the brother of B.');
  assert.equal(splitQuestion('How is Rose related to Victor? Victor met Rose.').story, 'Victor met Rose.');
  assert.equal(splitQuestion("Ashley's daughter, Lillian, asked her mom.").question, null);
});

test('letters used as people, not articles or "I"', () => {
  assert.deepEqual(letterNames('A is the brother of B. C is the father of A.'), ['A', 'B', 'C']);
  assert.deepEqual(letterNames("P's son Q and R."), ['P', 'Q', 'R']);
  assert.deepEqual(letterNames('A man met I and a dog.'), []);
  assert.deepEqual(letterNames('Victor asked his father George.'), []);
});

test('"X is the R of Y" becomes the possessive form', () => {
  assert.equal(forModel('Anil is the son of Kamla.'), "Kamla's son Anil was there.");
  assert.equal(forModel("A is the brother of B's father."), "A is the brother of B's father.");   // left alone
  assert.equal(forModel("Ashley's daughter Lillian."), "Ashley's daughter Lillian.");
});

test('spoken-clue puzzles are recognised', () => {
  assert.ok(spokenClue('Pointing to a photograph, A said, "He is the son of my father."'));
  assert.ok(!spokenClue("Victor asked his father George for advice."));
});

test('prepare: story without the question, rewritten for the model', () => {
  const p = prepare('P is the son of Q. Q is the wife of R. R is the father of S. How is P related to S?');
  assert.equal(p.b, 'P');
  assert.equal(p.a, 'S');
  assert.equal(p.plain, 'P is the son of Q. Q is the wife of R. R is the father of S.');
  assert.deepEqual(p.letters.sort(), ['P', 'Q', 'R', 'S']);
  assert.ok(p.model.startsWith("Q's son P was there."));
});
