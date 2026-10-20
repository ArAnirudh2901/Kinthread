import { possessive } from './story.js';

// The one mapping from the model's result `kind` to presentation. Components never inspect result text.
export const KINDS = {
  answer: { tone: 'found', badge: 'Connection found', icon: 'check' },
  'not sure': { tone: 'tentative', badge: 'Tentative', icon: 'tilde' },
  unknown: { tone: 'none', badge: 'No family link found', icon: 'gap' },
  refused: { tone: 'attention', badge: 'Check the selection', icon: 'alert' },
  same: { tone: 'attention', badge: 'Same person', icon: 'alert' },
  'too long': { tone: 'attention', badge: 'Story too long', icon: 'alert' },
};

export const kindOf = (result) => KINDS[result?.kind] || null;

// Decision rules applied inside kinship.js (KinshipQA.ask / predict), shown in Model details.
export const RULES = { minAgreement: 0.7, unknownThreshold: 0.5, beam: 4, views: 1 };

// Measured with these rules on held-out questions (LLM repo web/test/calib.json; people given, not detected).
export const CALIBRATION = {
  val: { questions: 300, steps: '2–4', confident: 256, confidentCorrect: 0.957, tentative: 43, tentativeCorrect: 0.488 },
  test: { questions: 200, steps: '2–10', confident: 96, confidentCorrect: 0.552, tentative: 91, tentativeCorrect: 0.363 },
};

/** People the model refused: selected, but not among the people it found. */
export const missingPeople = (run) => [run.a, run.b].filter((n) => n && !run.result.people?.includes(n));

/** One plain sentence per result, for the screen-reader announcement. */
export function announce(run) {
  const { result: r, a, b } = run;
  switch (r.kind) {
    case 'answer': return `${b} is ${possessive(a)} ${r.relation}.`;
    case 'not sure': return `Tentative. Best guess: ${b} is ${possessive(a)} ${r.relation}.`;
    case 'unknown': return `The story doesn't establish a relationship between ${a} and ${b}.`;
    case 'refused': return `${missingPeople(run).join(' and ') || 'A selected person'} could not be found in the story.`;
    case 'same': return 'You selected the same person twice. Choose two different people.';
    case 'too long': return 'The story is too long for the model. Shorten it and solve again.';
    default: return 'Done.';
  }
}
