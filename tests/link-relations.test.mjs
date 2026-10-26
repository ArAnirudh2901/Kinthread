import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkRelationsFromFacts } from '../src/lib/model/link-relations.js';

test('v10 map labels reuse the answer facts without another model call', () => {
  const links = [['Arvind', 'Leena'], ['Lillian', 'Nicholas']];
  const facts = [
    { from: 'Arvind', to: 'Leena', relation: 'daughter' },
    { from: 'Nicholas', to: 'Lillian', relation: 'sister' },
  ];
  const got = linkRelationsFromFacts(links, facts, "Arvind's daughter Leena; Nicholas's sister Lillian.");
  assert.deepEqual(got, {
    'Arvind\u0000Leena': { rel: 'daughter', rev: false },
    'Lillian\u0000Nicholas': { rel: 'sister', rev: true },
  });
});

test('v10 map labels only use relation words present in the story', () => {
  const got = linkRelationsFromFacts(
    [['Ashley', 'Lillian']],
    [{ from: 'Ashley', to: 'Lillian', relation: 'daughter' }],
    "Ashley and Lillian visited the park.",
  );
  assert.deepEqual(got, {});
});
