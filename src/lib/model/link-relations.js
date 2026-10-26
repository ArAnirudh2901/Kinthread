const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build edge labels from facts already produced for the answer, without running the reader again. */
export function linkRelationsFromFacts(links, facts, story) {
  const map = {};
  for (const { from, to, relation } of facts || []) {
    if (!from || !to || !relation || !new RegExp(`\\b${escapeRegExp(relation)}\\b`, 'i').test(story)) continue;
    for (const [a, b] of links) {
      if (from === a && to === b) map[`${a}\u0000${b}`] = { rel: relation, rev: false };
      else if (from === b && to === a) map[`${a}\u0000${b}`] = { rel: relation, rev: true };
    }
  }
  return map;
}
