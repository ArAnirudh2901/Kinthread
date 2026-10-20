// Worked-answer layout: for every chain shape, labels and tags never overlap and nothing leaves the frame.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { solutionLayout, R } from '../src/lib/solution-layout.js';

const WORDS = ['father', 'mother', 'son', 'daughter', 'brother', 'sister', 'husband', 'wife', 'grandfather', 'grandson', 'uncle', 'niece'];
const overlap = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

function boxes(L) {
  const out = [];
  L.pts.forEach((p, i) => out.push({ kind: `person${i}`, x: p.x - R, y: p.y + L.shift - R, w: 2 * R, h: 2 * R }));
  L.labels.forEach((l, i) => out.push({ kind: `name${i}`, ...l.box, y: l.box.y + L.shift }));
  L.facts.forEach((f, i) => out.push({ kind: `fact${i}`, ...f.tag, y: f.tag.y + L.shift }));
  out.push({ kind: 'answer', ...L.answer.tag, y: L.answer.tag.y + L.shift });
  return out;
}

// every chain of 1-4 facts from a representative set, plus a few long ones
const chains = [];
for (const a of WORDS) {
  chains.push([a]);
  for (const b of WORDS) {
    chains.push([a, b]);
    for (const c of ['father', 'son', 'sister', 'wife']) chains.push([a, b, c]);
  }
}
chains.push(['father', 'father', 'son', 'son', 'daughter'], ['son', 'daughter', 'son', 'daughter', 'son', 'daughter'], ['brother', 'sister', 'brother', 'sister', 'brother']);

test(`${chains.length} chain shapes at desktop and phone widths: no overlaps, inside the frame`, () => {
  for (const width of [300, 520]) {
    for (const words of chains) {
      const n = words.length + 1;
      const L = solutionLayout(width, words, Array(n).fill(96), words.map(() => 112), 112);
      const bs = boxes(L);
      for (const b of bs) {
        assert.ok(b.x >= -0.5 && b.x + b.w <= L.width + 0.5, `${b.kind} outside width for ${words.join(' > ')} @${width}`);
        assert.ok(b.y >= -0.5 && b.y + b.h <= L.height + 0.5, `${b.kind} outside height for ${words.join(' > ')} @${width}`);
      }
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        // a fact tag sits on its own arrow between two people; only labels and tags must stay apart
        if (bs[i].kind.startsWith('person') && bs[j].kind.startsWith('person')) continue;
        assert.ok(!overlap(bs[i], bs[j]), `${bs[i].kind} overlaps ${bs[j].kind} for ${words.join(' > ')} @${width}`);
      }
    }
  }
});

test('generations: parents above, children below', () => {
  const L = solutionLayout(520, ['father', 'wife', 'daughter'], [60, 60, 60, 60], [80, 60, 90], 70);
  assert.ok(L.pts[1].y < L.pts[0].y && L.pts[2].y === L.pts[1].y && L.pts[3].y === L.pts[0].y);
  assert.equal(L.rows.length, 2);
});
