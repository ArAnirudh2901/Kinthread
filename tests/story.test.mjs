import assert from 'node:assert/strict';
import { test } from 'node:test';
import { announce, missingPeople } from '../src/lib/kinds.js';
import { buildPath, countWords, findInStory, parseSteps, possessive, stepSentence } from '../src/lib/story.js';
import { initialState, reducer } from '../src/components/workbench/state.js';

test('countWords', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('  Ashley’s daughter,\n Lillian. '), 3);
});

test('findInStory matches whole words and returns the story spelling', () => {
  const story = "Ashley's coworker Dana visited. Danaher did not.";
  assert.equal(findInStory(story, 'dana'), 'Dana');
  assert.equal(findInStory(story, 'Dan'), null);
  assert.equal(findInStory(story, 'two words'), null);
  assert.equal(findInStory(story, 'Zoë'), null);
  assert.equal(findInStory('Zoë met Ana.', 'zoë'), 'Zoë');
});

test('steps become an ordered path from A to B', () => {
  const steps = ['Ashley daughter Lillian', 'Lillian brother Nicholas'];
  assert.deepEqual(parseSteps(steps)[0], { from: 'Ashley', rel: 'daughter', to: 'Lillian' });
  assert.deepEqual(buildPath('Ashley', 'Nicholas', steps), { nodes: ['Ashley', 'Lillian', 'Nicholas'], edges: ['daughter', 'brother'], linked: true });
  assert.equal(buildPath('Ashley', 'Mark', steps).linked, false);
  assert.equal(buildPath('Ashley', 'Nicholas', []).linked, false);
  assert.equal(stepSentence({ from: 'Ashley', rel: 'daughter', to: 'Lillian' }), 'Lillian is Ashley’s daughter.');
  assert.equal(possessive('James'), 'James\u2019s');
});

test('announcements come from structured results', () => {
  assert.equal(announce({ a: 'Ashley', b: 'Nicholas', result: { kind: 'answer', relation: 'son' } }), 'Nicholas is Ashley’s son.');
  assert.match(announce({ a: 'A1', b: 'B1', result: { kind: 'not sure', relation: 'aunt' } }), /^Tentative/);
  assert.deepEqual(missingPeople({ a: 'Ashley', b: 'Dana', result: { kind: 'refused', people: ['Ashley'] } }), ['Dana']);
});

test('reducer: choosing people, stale answers, examples', () => {
  let st = reducer(initialState, { type: 'story', story: 'Ashley met Lillian.' });
  st = reducer(st, { type: 'people', story: 'Ashley met Lillian.', people: ['Ashley', 'Lillian'], tokens: 9 });
  // blanks fill in reading order: "How is [B] related to [A]?"
  st = reducer(st, { type: 'choose', name: 'Lillian' });
  assert.equal(st.b, 'Lillian');
  assert.equal(st.slot, 'a');
  assert.equal(st.autoRun, 0);   // one person is not a question yet
  st = reducer(st, { type: 'choose', name: 'Ashley' });
  assert.equal(st.a, 'Ashley');
  assert.equal(st.autoRun, 1);   // both chosen: solve at once
  assert.equal(reducer(st, { type: 'choose', name: 'Ashley' }).autoRun, 1);   // same pick again: no new run
  assert.equal(reducer(st, { type: 'swap' }).autoRun, 2);
  // detection for older text is ignored
  assert.equal(reducer(st, { type: 'people', story: 'old', people: [], tokens: 0 }), st);
  // a person who left the story is unselected
  st = reducer(st, { type: 'story', story: 'Ashley met Mark.' });
  st = reducer(st, { type: 'people', story: 'Ashley met Mark.', people: ['Ashley', 'Mark'], tokens: 9 });
  assert.equal(st.b, null);
  // late result for a superseded run is dropped
  st = reducer(st, { type: 'runStart', id: 2, story: st.story, a: 'Ashley', b: 'Mark', extra: [] });
  assert.equal(reducer(st, { type: 'runDone', id: 1, result: {} }), st);
  // examples select their people once detected, then ask to run
  st = reducer(st, { type: 'example', example: { story: 'S', a: 'X', b: 'Y' } });
  st = reducer(st, { type: 'people', story: 'S', people: ['X', 'Y'], tokens: 4 });
  assert.equal(st.a, 'X');
  assert.equal(st.b, 'Y');
  assert.equal(st.autoRun, 2);
});

test('extra names are dropped when they leave the story', () => {
  let st = reducer({ ...initialState, story: 'Dana smiled.' }, { type: 'addName', name: 'Dana' });
  st = reducer(st, { type: 'story', story: 'Someone smiled.' });
  assert.deepEqual(st.extra, []);
});

test('restoring a draft brings back the story and re-selects its people once found', () => {
  let st = reducer(initialState, { type: 'restore', story: 'Ashley met Dana.', extra: ['Dana'], a: 'Ashley', b: 'Dana' });
  assert.equal(st.story, 'Ashley met Dana.');
  st = reducer(st, { type: 'people', story: 'Ashley met Dana.', people: ['Ashley', 'Dana'], tokens: 9 });
  assert.equal(st.a, 'Ashley');
  assert.equal(st.b, 'Dana');
});

test('mention links come from the text: same sentence, or a pronoun-led follow-up', async () => {
  const { mentionLinks } = await import('../src/lib/story.js');
  const story = "Ashley's daughter, Lillian, asked her mom to read her a story. Nicholas's sister Lillian asked him for some help.";
  assert.deepEqual(mentionLinks(story, ['Ashley', 'Lillian', 'Nicholas']), [['Ashley', 'Lillian'], ['Lillian', 'Nicholas']]);
  assert.deepEqual(mentionLinks('Rosa fished with Mateo. Hannah baked with Ingrid.', ['Rosa', 'Mateo', 'Hannah', 'Ingrid']), [['Mateo', 'Rosa'], ['Hannah', 'Ingrid']]);
  assert.deepEqual(mentionLinks('Ann smiled. She called Bo.', ['Ann', 'Bo']), [['Ann', 'Bo']]);
  assert.deepEqual(mentionLinks('Ann smiled.', ['Ann']), []);
});
