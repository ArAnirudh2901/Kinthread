import Link from 'next/link';
import PageIntro from '@/components/content/PageIntro';
import StepsChart from '@/components/content/StepsChart';
import s from '@/components/content/content.module.css';
import { RUNTIME } from '@/lib/runtime.generated';

export const metadata = {
  title: 'Limits & tips',
  description: 'What Kinthread handles well, where it struggles, and how to write stories it reads best.',
};

const SECTIONS = [
  ['language', 'English family stories'],
  ['names', 'Names, in the third person'],
  ['exam', 'Exam questions'],
  ['length', 'About 280 words'],
  ['relations', 'Eighteen relationships'],
  ['chains', 'Short chains are more reliable'],
  ['detection', 'Names can be missed'],
  ['unknown', 'Unknown versus tentative'],
  ['friends', 'Friends are the hardest case'],
  ['tips', 'Writing tips'],
];

export default function Limits() {
  const relations = RUNTIME.facts.qa.relations;
  return (
    <main id="main">
      <PageIntro eyebrow="Limits & tips" title="Small, specialised, honest about it.">
        <p>
          Kinthread does one thing: it works out how two people in a short family story are related. Knowing where its
          edges are helps you get good answers, and helps you read the ones it is unsure about.
        </p>
      </PageIntro>

      <div className={`container ${s.layout}`}>
        <nav className={s.toc} aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <ol>{SECTIONS.map(([id, t]) => <li key={id}><a href={`#${id}`}>{t}</a></li>)}</ol>
        </nav>
        <article className="prose">
          <h2 id="language">English family stories</h2>
          <p>
            Both models were trained only on English text written as short stories about families. Other languages,
            lists, family trees in tables, or questions typed as a sentence will not work reliably.
          </p>

          <h2 id="names">Names, in the third person</h2>
          <p>Every person you want to ask about needs a name in the story, and the story should talk about them, not as &ldquo;I&rdquo;.</p>
          <ul>
            <li><strong>Works:</strong> &ldquo;Ashley&rsquo;s daughter Lillian asked her mom to read her a story.&rdquo;</li>
            <li><strong>Won&rsquo;t work:</strong> &ldquo;My mom took me to see my grandma.&rdquo; There are no names to connect.</li>
          </ul>

          <h2 id="exam">Exam questions</h2>
          <p>
            You can paste a textbook blood-relation question as it is. Kinthread finds the question (&ldquo;How is C related
            to B?&rdquo;), fills in the two people, ignores answer options like &ldquo;(a) Uncle&rdquo;, and solves it.
          </p>
          <ul>
            <li><strong>Works:</strong> &ldquo;A is the brother of B. C is the father of A. How is C related to B?&rdquo; Letters work as names.</li>
            <li><strong>Works:</strong> &ldquo;What is C to B?&rdquo;, &ldquo;C is related to B as?&rdquo; and &ldquo;How C is related to B?&rdquo;</li>
            <li>
              <strong>Not yet:</strong> spoken-clue puzzles such as &ldquo;Pointing to a photograph, A said, &lsquo;He is the son of my
              father.&rsquo;&rdquo; Rewrite the clue as plain facts first: &ldquo;He is A&rsquo;s brother.&rdquo;
            </li>
            <li><strong>Not yet:</strong> coded relations (&ldquo;A + B means A is the father of B&rdquo;).</li>
          </ul>

          <h2 id="length">About 280 words</h2>
          <p>
            The model reads at most {RUNTIME.facts.qa.block_size - 16} tokens of question and story. Punctuation and
            &ldquo;&rsquo;s&rdquo; count as tokens, so the real limit is a little under 280 words. The meter under the
            story shows exactly how much of the model&rsquo;s context the story uses. A story can mention at most 32
            different people.
          </p>

          <h2 id="relations">Eighteen relationships</h2>
          <p>Answers are always one of these:</p>
          <ul className={s.relations}>{relations.map((r) => <li key={r}>{r}</li>)}</ul>
          <p>
            Stories can mention husbands and wives, and the model uses them as steps on a path, but they are not possible
            answers. Neither are cousins, great-grandparents, step-relatives, half-siblings, or in-laws beyond the four
            listed. Asking about those gives a wrong or tentative answer.
          </p>

          <h2 id="chains">Short chains are more reliable</h2>
          <p>
            A chain is the number of family facts needed to get from one person to the other. Two to four steps work well;
            longer chains are much harder for a model this small.
          </p>
          <StepsChart />

          <h2 id="detection">Names can be missed</h2>
          <p>
            The name model is very accurate on ordinary names but not perfect. It can miss a name in an unusual position
            (&ldquo;her coworker Dana&rdquo;) or mistake a place for a person (&ldquo;they visited Kyoto&rdquo;). Names
            should start with a capital letter. If someone is missing, choose <em>Missing someone? Add a name</em> and type
            the name exactly as it appears.
          </p>

          <h2 id="unknown">Unknown versus tentative</h2>
          <ul>
            <li>
              <strong>&ldquo;The story doesn&rsquo;t establish a relationship&rdquo;</strong> means nothing in the text
              connects them as family, or the model could not verify any family path. It is a deliberate refusal to guess.
            </li>
            <li>
              <strong>&ldquo;My best guess&rdquo;</strong> means the model found a path but its reasoning paths disagree
              about the answer. Treat it as a guess: on held-out stories these were right about half the time.
            </li>
          </ul>

          <h2 id="friends">Friends are the hardest case</h2>
          <p>
            When the only link is a friend, coworker or neighbour, the model correctly says the story doesn&rsquo;t
            establish a family relationship only about half the time (47% of held-out friend and stranger questions).
            Two families that never meet are much easier: the text check catches 96.5% of them. Be sceptical of an answer
            about someone who is only a friend.
          </p>

          <h2 id="tips">Writing tips</h2>
          <ul>
            <li>Use possessives: &ldquo;Rahul&rsquo;s mother Sunita&rdquo; is clearer than &ldquo;Sunita, who is a mother, and Rahul&rdquo;.</li>
            <li>One relationship per clause, with the names close to the relationship word.</li>
            <li>Keep pronouns near the person they refer to, and avoid an ambiguous &ldquo;they&rdquo;.</li>
            <li>Leave out sentences that don&rsquo;t describe how people are related; they add length and distraction.</li>
          </ul>
          <p>Ready to try? <Link href="/">Go back to the workbench</Link>.</p>
        </article>
      </div>
    </main>
  );
}
