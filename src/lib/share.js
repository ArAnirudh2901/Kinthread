// A question as a link. It lives in the #hash, which browsers never send to a server, so a shared story stays private.
const MAX_STORY = 6000, MAX_NAME = 60;

export function shareHash({ story, a, b }) {
  const p = new URLSearchParams({ story });
  if (a) p.set('a', a);
  if (b) p.set('b', b);
  return `#${p.toString()}`;
}

/** The shared question in a hash, or null if there is none or it is malformed or oversized. */
export function readShare(hash) {
  if (!hash || hash.length < 8 || !hash.includes('story=')) return null;
  let p;
  try { p = new URLSearchParams(hash.slice(1)); } catch { return null; }
  const story = p.get('story');
  if (!story || typeof story !== 'string' || story.length > MAX_STORY || !story.trim()) return null;
  const name = (v) => (v && v.length <= MAX_NAME && story.includes(v) ? v : null);
  return { story, a: name(p.get('a')), b: name(p.get('b')) };
}
