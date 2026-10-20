// The worked answer as plain sentences, shared by the step list and the caption under the map.
import { deduce, evidence } from './relations.js';
import { splitQuestion } from './exam.js';
import { buildPath, personLabel, possessive, stepSentence } from './story.js';

export function workedSteps(run, tentative = false) {
  const { result: r, a, b, story } = run;
  const path = buildPath(a, b, r.steps);
  const words = path.edges;
  const steps = deduce(words);
  const A = personLabel(a), B = personLabel(b);
  const rows = [{ tone: 'question', badge: '?', text: `The question: how is ${B} related to ${A}?`, quote: null, so: null, note: null }];
  words.forEach((w, i) => {
    const from = personLabel(path.nodes[i]), to = personLabel(path.nodes[i + 1]);
    const d = steps[i];
    rows.push({
      tone: 'fact',
      badge: String(i + 1),
      text: stepSentence({ from, rel: w, to }),
      quote: evidence(splitQuestion(story).story, path.nodes[i], path.nodes[i + 1]),
      so: i === 0 ? null : `So ${to} is ${possessive(A)} ${d.phrase}${d.word ? `, which makes ${to} ${possessive(A)} ${d.word}` : ''}.`,
      word: i === 0 ? null : d.word,
      note: d.note,
    });
  });
  // the working in one line, for the caption: "Victor's father's wife's daughter is Victor's sister."
  const last = steps[steps.length - 1];
  const sum = words.length > 1 ? `${possessive(A)} ${last.phrase}${last.word ? ` is ${possessive(A)} ${last.word}` : ` is ${B}`}.` : null;
  rows.push({ tone: 'answer', badge: '✓', text: `${tentative ? 'Best guess' : 'Answer'}: ${B} is ${possessive(A)} ${r.relation}.`, quote: null, so: null, note: null, sum });
  return { rows, path, steps, final: steps[steps.length - 1] };
}
