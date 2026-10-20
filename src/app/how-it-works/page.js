import Link from 'next/link';
import PageIntro from '@/components/content/PageIntro';
import PipelineDiagram from '@/components/content/PipelineDiagram';
import s from '@/components/content/content.module.css';
import { RULES } from '@/lib/kinds';
import { mb, millions } from '@/lib/format';
import { RUNTIME } from '@/lib/runtime.generated';
import { deduce } from '@/lib/relations';

export const metadata = {
  title: 'How it works',
  description: 'How Kinthread finds the people in a story and traces how two of them are related, using two small models that run in your browser.',
};

// textbook combinations, worked out by the same rules the map uses (src/lib/relations.js)
const PAIRS = [
  ['father', 'wife'], ['mother', 'brother'], ['father', 'sister'], ['brother', 'son'], ['sister', 'daughter'],
  ['son', 'wife'], ['daughter', 'husband'], ['wife', 'father'], ['father', 'father'], ['son', 'son'],
  ['daughter', 'brother'], ['mother', 'daughter'],
].map((w) => [w, deduce(w).at(-1)]);

const SEQ = ['<bos>', '<q>', '@0', '@2', '<s>', '@0', "'s", 'daughter', ',', '@1', ',', 'asked', 'her', 'mom', '…', '<c>'];

export default function HowItWorks() {
  const { qa, tagger } = RUNTIME.facts;
  return (
    <main id="main">
      <PageIntro eyebrow="How it works" title="From a story to a thread.">
        <p>
          Kinthread finds the people in your story, then traces the family facts that connect the two you choose.
          Two small models do the work, inside this browser tab.
        </p>
      </PageIntro>

      <section className="container" aria-label="The three stages">
        <PipelineDiagram />
      </section>

      <div className="container">
        <article className="prose">
          <h2>Reading the map</h2>
          <p>
            After you trace, the map works the answer out in front of you, one step at a time, the way you would on paper.
            Use the buttons under it to pause, step back, or jump to the answer.
          </p>
          <ul>
            <li><strong>Indigo</strong> marks the question: the two people you chose, and a dashed arrow with a &ldquo;?&rdquo; between them.</li>
            <li><strong>Gold</strong> arrows are facts from the story, numbered in the order the reasoning uses them. Each step quotes the sentence it came from.</li>
            <li><strong>Red</strong> is the answer: the red thread between the two people that replaces the question.</li>
            <li>Shapes follow the pedigree charts used in biology: <strong>squares</strong> are male, <strong>circles</strong> female, and a <strong>diamond</strong> means the story never says.</li>
            <li>Rows are generations: parents above, children below, people of the same generation side by side.</li>
            <li>Arrows point from a person to their relative: <em>Ashley &rarr; daughter &rarr; Lillian</em> means Lillian is Ashley&rsquo;s daughter.</li>
          </ul>

          <h2>Solve it like a student</h2>
          <p>
            Blood-relation questions are solved by combining two relations at a time. Each step on the map does exactly that,
            so you can check your own working against it. These combinations are worked out by the same rules the map uses:
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>Two relations at a time</caption>
              <thead><tr><th scope="col">If B is A&rsquo;s&hellip;</th><th scope="col">and C is B&rsquo;s&hellip;</th><th scope="col">then C is A&rsquo;s&hellip;</th></tr></thead>
              <tbody>
                {PAIRS.map(([[x, y], d]) => (
                  <tr key={x + y}><td>{x}</td><td>{y}</td><td><strong>{d.word}</strong>{d.note ? ' (usually)' : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Some combinations have more than one honest answer. A daughter&rsquo;s uncle is usually your brother, but could
            be your brother-in-law; the map says &ldquo;usually&rdquo; and names the other possibility. When the steps the model
            wrote do not add up to its own answer, the map says so instead of hiding it.
          </p>

          <h2>Everything happens on your device</h2>
          <p>
            On your first visit the browser downloads the two models ({mb(RUNTIME.model.totalBytes)} MB) and keeps them.
            Each file is checked against a SHA-256 checksum before it is stored, and the decoded weights are checked again
            (CRC-32) every time they load. Later visits read the models from this device.
          </p>
          <p>
            The models run in a background worker so the page never freezes. The arithmetic happens in a small engine
            written in C and compiled to WebAssembly, using SIMD instructions and several CPU threads when the browser
            allows. Your story is not sent to a server for inference.
          </p>

          <h2>Step 1: finding the people</h2>
          <p>
            The name model is a {millions(tagger.params)}-parameter GPT ({tagger.n_layer} layers) trained from scratch to
            decide, word by word, whether the word is a person&rsquo;s name. A GPT only looks backwards, so it reads the
            text twice: while labelling the second copy, every word can see the whole sentence.
          </p>
          <p>
            It learned from tens of thousands of stories with places, companies, months and holidays mixed in, so
            &ldquo;Tokyo&rdquo; or &ldquo;Google&rdquo; do not become people. It still makes mistakes; if it misses
            someone, use <em>Missing someone? Add a name</em> under the people.
          </p>

          <h2>Step 2: reading the story the way the model does</h2>
          <p>
            Before the relationship model sees the story, every name becomes an entity id: the first person is
            <code>@0</code>, the next <code>@1</code>, and so on. The model therefore learns relationships from the
            wording (&ldquo;her son&rdquo;, &ldquo;his sister&rdquo;), not from what particular names usually mean. The
            question comes first, then the story:
          </p>
          <ol className={s.seq} aria-label="Model input">
            {SEQ.map((t, i) => <li key={i} className={t.startsWith('@') ? s.ent : t.startsWith('<') ? s.sp : undefined}>{t}</li>)}
          </ol>
          <p>
            The relationship model is a {millions(qa.params)}-parameter transformer with {qa.n_layer} layers,{' '}
            {qa.n_head} attention heads and a {qa.block_size}-token context. Before answering, it writes the family facts
            along the path, a chain of thought: <code>@0 daughter @1</code>, then <code>@1 brother @2</code>, then the
            answer, <code>son</code>.
          </p>

          <h2>Step 3: searching for a path</h2>
          <p>
            The chain is found with a constrained beam search that keeps the {RULES.beam} most likely partial paths. At
            each step the model may only pick a relation word and a person who appears in the story and is not already on
            the path, and the path must end at the person you asked about.
          </p>
          <p>
            After every step the model also judges whether that fact is actually stated in the story. Paths built on
            facts it cannot verify lose weight. This step checker was trained on deliberately wrong chains, including
            convincing mistakes found by running the model&rsquo;s own search.
          </p>

          <h2>Knowing when to say &ldquo;I don&rsquo;t know&rdquo;</h2>
          <ul>
            <li>
              <strong>No link in the text.</strong> If the two people are never mentioned together, or through people
              who are, Kinthread answers that the story doesn&rsquo;t establish a relationship without running the model.
            </li>
            <li>
              <strong>No verified path.</strong> The model estimates how likely it is that the story gives no family link.
              At {RULES.unknownThreshold.toFixed(2)} or above, it says so instead of guessing.
            </li>
            <li>
              <strong>Disagreement.</strong> Agreement is the share of its weighted reasoning paths that end in the top
              answer. Below {RULES.minAgreement.toFixed(2)}, the answer is shown as a tentative best guess.
            </li>
          </ul>
          <div className={s.callout}>
            <p>
              <strong>What the path is, and isn&rsquo;t.</strong> The steps on the map are the chain the model wrote down
              before answering. They are an exact record of that chain, not a full account of every calculation inside the
              network.
            </p>
          </div>

          <details className={s.tech}>
            <summary>Technical view</summary>
            <div>
              <h3>Decision rules</h3>
              <ul>
                <li>p(unknown) = max(p<sub>start</sub>, 1 &minus; p<sub>link</sub>). p<sub>start</sub>: probability of the
                  answer marker instead of the first person at the start of the chain. p<sub>link</sub>: probability-weighted share
                  of steps the checker accepted (<code>&lt;sep&gt;</code> rather than <code>&lt;nofact&gt;</code>).</li>
                <li>Answer = relation with the most weighted votes over finished paths; agreement = its vote share.</li>
                <li>Search: beam {RULES.beam}, branching 3 per step, one person-id view (the 4-view, beam-8 reference setting
                  scored the same on average at about six times the compute).</li>
              </ul>
              <h3>Engine</h3>
              <ul>
                <li>Six WebAssembly builds (relaxed SIMD, SIMD, scalar; each with and without threads). The page picks the
                  fastest one this browser supports.</li>
                <li>Matrix-multiply tiles and the thread count are tuned on this device when the model loads.</li>
                <li>A shared key/value cache: every token on a path is computed once and reused by all paths that share it.</li>
                <li>Weights are the original 32-bit floats, not quantized. Outputs match PyTorch to within 1.5&times;10<sup>-5</sup>.</li>
              </ul>
            </div>
          </details>

          <p>
            Want the full story of how both models were built and trained? Read the <Link href="/build-log/">build log</Link>.
            For what the models handle well and where they struggle, see <Link href="/limits/">limits &amp; tips</Link>.
          </p>
        </article>
      </div>
    </main>
  );
}
