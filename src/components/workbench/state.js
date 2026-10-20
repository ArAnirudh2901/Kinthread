import { findInStory, keepIf } from '../../lib/story.js';

export const initialState = {
  story: '',
  extra: [],          // names the user added because the name model missed them
  people: [],         // from the name model (+ extra), for `detected` text
  tokens: 0,          // story length in model tokens, for `detected` text
  detected: null,     // story text the people/tokens belong to
  a: null,
  b: null,
  slot: 'b',          // which blank the next chip click fills; B comes first in the question
  want: null,         // example selection waiting for detection: { a, b }
  autoRun: 0,         // bumped when an example is ready to trace
  run: null,          // latest trace: { id, status, story, a, b, extra, result?, trace?, roundTripMs?, error? }
  last: null,         // latest finished trace, shown while a new one runs
};

export function reducer(st, ev) {
  switch (ev.type) {
    case 'story': {
      const extra = st.extra.filter((n) => findInStory(ev.story, n));
      // a question typed or pasted into the story ("How is C related to B?") fills the blanks once found
      const asked = ev.want && (ev.want.a !== st.a || ev.want.b !== st.b) ? ev.want : null;
      return { ...st, story: ev.story, extra, want: asked || (ev.keepWant ? st.want : null) };
    }
    case 'people': {
      if (ev.story !== st.story) return st;   // answer for text the user has since changed
      let { a, b, want, autoRun, slot } = st;
      a = keepIf(a, ev.people);
      b = keepIf(b, ev.people);
      if (want && ev.people.includes(want.a) && ev.people.includes(want.b)) {
        a = want.a; b = want.b; want = null; autoRun = st.autoRun + 1;
      }
      if (!b) slot = 'b';
      else if (!a) slot = 'a';
      return { ...st, people: ev.people, tokens: ev.tokens, detected: ev.story, a, b, want, autoRun, slot };
    }
    case 'addName':
      return st.extra.includes(ev.name) ? st : { ...st, extra: [...st.extra, ev.name] };
    case 'removeName':
      return {
        ...st,
        extra: st.extra.filter((n) => n !== ev.name),
        a: st.a === ev.name ? null : st.a,
        b: st.b === ev.name ? null : st.b,
      };
    case 'slot':
      return { ...st, slot: ev.slot };
    case 'choose': {
      const next = { ...st, [st.slot]: ev.name };
      if (st.slot === 'b' && !next.a) next.slot = 'a';
      else if (st.slot === 'a' && !next.b) next.slot = 'b';
      if (next.a && next.b && (next.a !== st.a || next.b !== st.b)) next.autoRun = st.autoRun + 1;   // both chosen: trace now
      return next;
    }
    case 'swap':
      return { ...st, a: st.b, b: st.a, autoRun: st.a && st.b ? st.autoRun + 1 : st.autoRun };
    case 'example':
      return { ...initialState, story: ev.example.story, want: { a: ev.example.a, b: ev.example.b }, autoRun: st.autoRun, last: st.last };
    case 'clear':
      return { ...initialState, autoRun: st.autoRun };
    case 'restore':
      return { ...st, story: ev.story, extra: ev.extra, want: ev.a && ev.b ? { a: ev.a, b: ev.b } : null };
    case 'runStart':
      return { ...st, run: { id: ev.id, status: 'running', story: ev.story, a: ev.a, b: ev.b, extra: ev.extra } };
    case 'runDone':
      if (st.run?.id !== ev.id) return st;
      {
        const run = { ...st.run, status: 'done', result: ev.result, trace: ev.trace, roundTripMs: ev.roundTripMs };
        return { ...st, run, last: run };
      }
    case 'runError':
      if (st.run?.id !== ev.id) return st;
      return { ...st, run: { ...st.run, status: 'error', error: ev.error } };
    default:
      return st;
  }
}
