import Link from 'next/link';
import LiveStats from '@/components/content/LiveStats';
import PageIntro from '@/components/content/PageIntro';
import s from '@/components/content/content.module.css';
import { SOURCE_URL } from '@/components/layout/SiteFooter';
import { mb, millions } from '@/lib/format';
import { RUNTIME } from '@/lib/runtime.generated';

export const metadata = {
  title: 'Build log',
  description: 'How Kinthread’s two models were designed, trained from scratch, evaluated, and shipped to run in the browser.',
};

const SECTIONS = [
  ['why', 'Why this exists'],
  ['architecture', 'Architecture'],
  ['data', 'Dataset design'],
  ['training', 'Training'],
  ['evaluation', 'Evaluation'],
  ['errors', 'Error analysis'],
  ['names', 'The name model'],
  ['browser', 'Running in the browser'],
  ['backend', 'Why WebAssembly, not WebGPU'],
  ['explainer', 'Explaining answers step by step'],
  ['worker', 'Worker architecture'],
  ['offline', 'Caching and offline use'],
  ['speed', 'Latency and memory'],
  ['lessons', 'Challenges and lessons'],
];

const n = (x) => x.toLocaleString('en-US');

export default function BuildLog() {
  const { qa, tagger } = RUNTIME.facts;
  return (
    <main id="main">
      <PageIntro eyebrow="Build log &middot; October 2026" title="Two models, trained from scratch, shipped to a browser tab.">
        <p>
          No hosted AI API sits behind Kinthread. Both models were written, trained and evaluated as part of a
          from-scratch study of transformers, then compiled into a page that runs them on your own device.
        </p>
      </PageIntro>

      <div className={`container ${s.layout}`}>
        <nav className={s.toc} aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <ol>{SECTIONS.map(([id, t]) => <li key={id}><a href={`#${id}`}>{t}</a></li>)}</ol>
        </nav>

        <article className="prose">
          <h2 id="why">Why this exists</h2>
          <p>
            The project started as an exercise in building a language model from first principles: attention, then a small
            GPT, then a model that has to reason rather than recite. Family relationships are a good test because the
            answer is checkable, chains can be made longer to stress the model, and a wrong answer is easy to spot.
          </p>
          <div className={s.placeholder}>
            <strong>Placeholder: in your own words</strong>
            Add why you started this project, what you wanted to learn, and what surprised you. This is the part only you can write.
          </div>

          <h2 id="architecture">Architecture</h2>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>Both models are decoder-only transformers (GPT), pre-norm, GELU, learned positions</caption>
              <thead><tr><th scope="col" /><th scope="col" className={s.num}>Relationship model</th><th scope="col" className={s.num}>Name model</th></tr></thead>
              <tbody>
                <tr><th scope="row">Parameters</th><td className={s.num}>{n(qa.params)}</td><td className={s.num}>{n(tagger.params)}</td></tr>
                <tr><th scope="row">Layers</th><td className={s.num}>{qa.n_layer}</td><td className={s.num}>{tagger.n_layer}</td></tr>
                <tr><th scope="row">Attention heads</th><td className={s.num}>{qa.n_head}</td><td className={s.num}>{tagger.n_head}</td></tr>
                <tr><th scope="row">Embedding width</th><td className={s.num}>{qa.n_embd}</td><td className={s.num}>{tagger.n_embd}</td></tr>
                <tr><th scope="row">Context (tokens)</th><td className={s.num}>{qa.block_size}</td><td className={s.num}>{tagger.block_size}</td></tr>
                <tr><th scope="row">Vocabulary</th><td className={s.num}>{n(qa.vocab_size)}</td><td className={s.num}>{n(tagger.vocab_size)}</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            The relationship model reads the question and story with names replaced by entity ids (<code>@0</code> to{' '}
            <code>@31</code>), writes a chain of family facts, then the answer. The name model reads a text twice and labels
            each word of the second copy as a name or not.
          </p>

          <h2 id="data">Dataset design</h2>
          <p>
            The relationship model learned from <a href="https://github.com/facebookresearch/clutrr" rel="noopener noreferrer">CLUTRR</a>,
            a benchmark of short family stories that need several reasoning steps. Evaluation uses its
            <code>gen_train234_test2to10</code> configuration: validation stories need 2 to 4 steps, test stories 2 to 10.
            Training used {n(64554)} stories from the other splits, after removing any story that matched a held-out story
            up to the names.
          </p>
          <p>Three kinds of data were added on top, because the original benchmark always has an answer:</p>
          <ul>
            <li><strong>Unanswerable questions:</strong> a friend or stranger, two families that never meet, or a person who is not in the story. Target: &ldquo;unknown&rdquo;.</li>
            <li><strong>Distractors:</strong> unrelated sentences mixed into answerable stories.</li>
            <li><strong>Wrong chains:</strong> paths with one invented, swapped or near-miss step, labelled with a <code>&lt;nofact&gt;</code> token so the model learns to check each step against the story.</li>
          </ul>

          <h2 id="training">Training</h2>
          <ul>
            <li>PyTorch on an 8 GB Apple M2 laptop (Metal backend).</li>
            <li>AdamW (&beta; 0.9, 0.95; weight decay 0.1), learning rate 5&times;10<sup>-4</sup> with 300 warm-up steps, batch 32, dropout 0.1.</li>
            <li>Loss on the chain and the answer, plus a small next-word loss on the story text (weight 0.1).</li>
            <li>30% of questions were sub-questions taken from the dataset&rsquo;s proofs, so short hops are practised often.</li>
            <li>
              The final version adds <strong>hard-negative mining</strong>: every 200 steps, the model&rsquo;s own beam
              search runs on 512 unanswerable questions, and every convincing wrong chain it finds becomes a training example
              for the step checker.
            </li>
          </ul>

          <h2 id="evaluation">Evaluation</h2>
          <p>
            Accuracy is measured on held-out stories the model never saw, with a reference search setting (beam 8, four
            person-id orderings voting) and the lighter setting this site uses (beam 4, one ordering). On 950 labelled
            questions the light setting matched the reference on average at about one sixth of the compute.
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>Relationship model versions, reference setting</caption>
              <thead>
                <tr><th scope="col">Version</th><th scope="col">Change</th><th scope="col" className={s.num}>Val, 2&ndash;4 steps</th><th scope="col" className={s.num}>Test, 2&ndash;10</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">v4</th><td>Chain of thought, beam search, voting</td><td className={s.num}>89.2%</td><td className={s.num}>44.8%</td></tr>
                <tr><th scope="row">v7</th><td>Step checker with wrong-chain training</td><td className={s.num}>88.5%</td><td className={s.num}>40.4%</td></tr>
                <tr><th scope="row">v8</th><td>Hard-negative mining (shipped)</td><td className={s.num}>89.8%</td><td className={s.num}>44.8%</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            v8 kept v4&rsquo;s accuracy while learning to say &ldquo;unknown&rdquo;: it now refuses 92% of questions about a
            person who is not in the story. An end-to-end check on plain text with invented names (name model, rules and
            relationship model together) gave 90% correct on validation stories, with only 2% confidently wrong.
          </p>

          <h2 id="errors">Error analysis</h2>
          <ul>
            <li><strong>Long chains.</strong> Accuracy falls from 99% at two steps to roughly a third beyond six. A 13M-parameter model has little room to hold long chains of facts.</li>
            <li><strong>Friends and strangers.</strong> The hardest unanswerable case: friendship sentences look like family sentences. The model alone catches 46% (reference setting); a rule that checks whether two people are ever mentioned together brings two-family stories to 96.5%.</li>
            <li><strong>Distractors.</strong> Unrelated sentences cost about 11 points on validation stories (78.2% vs 89.8%).</li>
          </ul>
          <p>Confident answers are much more reliable than tentative ones; the <Link href="/limits/#chains">limits page</Link> shows accuracy by chain length.</p>

          <h2 id="names">The name model</h2>
          <p>
            A causal model cannot look ahead, but deciding whether &ldquo;May&rdquo; is a name needs the words after it. The
            fix is to feed the text twice and read the labels from the second copy, where every word can attend to the whole
            first copy. Trained on {n(64554)} stories with a pool of 630 names, plus places, companies, languages, months and
            holidays, and with short snippets and lower-case text so it does not depend on position or capitals:
          </p>
          <ul>
            <li>F1 0.998 on names it never saw in training.</li>
            <li>Real places or companies tagged as people: 7.3% (6.7% in short texts, down from 52% before short-text training).</li>
          </ul>

          <h2 id="browser">Running in the browser</h2>
          <p>
            A 460-line C engine implements the forward pass (layer norm, attention with a shared key/value cache, GELU,
            matrix multiplies) and is compiled to WebAssembly with Emscripten into six builds: relaxed SIMD, SIMD and plain
            scalar, each with and without threads. Each build is 28 to 46 KB. At load, the page tests which builds the
            browser accepts and tunes matrix-multiply tiles and the thread count for the CPU.
          </p>
          <p>
            Weights stay at their original 32-bit precision. To shrink the download losslessly, the four bytes of every float
            are split into separate planes before gzip, which compresses better: the relationship model goes from 52.0 MB to
            44.2 MB. The browser streams the parts straight into WebAssembly memory as they arrive. Results match PyTorch
            to within 1.5&times;10<sup>-5</sup> and pick the same answer and chain on all 60 reference questions.
          </p>

          <h2 id="backend">Why WebAssembly, not WebGPU</h2>
          <p>
            A GPU sounds like the obvious choice for a neural network, so it was measured rather than assumed. The
            benchmark (<code>tools/bench-webgpu.html</code>) runs this model&rsquo;s real workload both ways on an Apple M2:
            the WebAssembly engine as shipped, and a WebGPU compute kernel doing the same matrix multiplications with the
            same weight shapes, reading results back after every step as the search requires.
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>Apple M2, October 2026 (median of 15&ndash;30 runs)</caption>
              <thead><tr><th scope="col" /><th scope="col" className={s.num}>Chrome 155</th><th scope="col" className={s.num}>Safari 27</th></tr></thead>
              <tbody>
                <tr><th scope="row">WebAssembly: whole question</th><td className={s.num}>24.7 ms</td><td className={s.num}>25.7 ms</td></tr>
                <tr><th scope="row">WebAssembly: one search step</th><td className={s.num}>1.6 ms</td><td className={s.num}>1.9 ms</td></tr>
                <tr><th scope="row">WebGPU: one search step (matrix work only)</th><td className={s.num}>5.1&ndash;7.7 ms</td><td className={s.num}>7.1&ndash;17.2 ms</td></tr>
                <tr><th scope="row">WebGPU: one-time setup</th><td className={s.num}>0.9 s</td><td className={s.num}>0.9 s</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Even counting only its matrix work, the GPU is three to nine times slower per step. Beam search is a chain of
            small decisions: each step processes 1 to 12 rows, then the CPU must read the results to choose the next step.
            At that size the cost of sending work to the GPU and reading it back outweighs the GPU&rsquo;s raw speed, and
            uploading the weights and compiling shaders adds almost a second at start-up. WebGPU would pay off for much
            larger batches or a much larger model; for this one, a tuned CPU engine that adapts to the device (relaxed
            SIMD, SIMD or plain WebAssembly, with or without threads, tiles and thread count tuned on load) is faster
            everywhere and works on far more devices.
          </p>

          <h2 id="explainer">Explaining answers step by step</h2>
          <p>
            The map turns the model&rsquo;s chain of facts into a worked solution: a family tree drawn by generation, built
            in reasoning order, with each step combined with the last using fixed kinship rules (&ldquo;father&rsquo;s wife
            is mother&rdquo;). Those rules are code, not model output, and are unit-tested. Checked against the model on 299
            held-out validation questions, they produce a step-by-step deduction for 277 and agree with the model&rsquo;s
            answer on 265. When they disagree, the page shows the warning rather than the comfortable story. The layout is
            tested on 735 chain shapes at phone and desktop widths for overlapping labels.
          </p>

          <h2 id="worker">Worker architecture</h2>
          <p>
            The page never runs the model itself. A module Web Worker loads the engine and both models once, then answers
            messages: find the people in a text, or answer a question. Every request carries an id so a late answer for an
            edited story is ignored. Threaded builds start their own helper workers, which needs a cross-origin isolated page
            (<code>Cross-Origin-Opener-Policy</code> and <code>Cross-Origin-Embedder-Policy</code> headers); without them the
            single-threaded build runs instead.
          </p>

          <h2 id="offline">Caching and offline use</h2>
          <ul>
            <li>Model files live under a content-hashed path, so a new model never mixes with old runtime code and files can be cached forever.</li>
            <li>Weights are split into parts of at most 16 MiB ({mb(RUNTIME.model.totalBytes)} MB in total), downloaded three at a time, checked against SHA-256, and stored in the browser&rsquo;s Cache Storage.</li>
            <li>A damaged file is detected (checksum, gzip check or the CRC-32 of the decoded weights), discarded, and downloaded again. Only this site&rsquo;s model files are touched.</li>
            <li>A service worker keeps the pages and engine available offline. Old model versions are deleted when a new one loads.</li>
          </ul>

          <h2 id="speed">Latency and memory</h2>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>One question, Chrome on an Apple M2 laptop (median of 100)</caption>
              <thead><tr><th scope="col">Engine build</th><th scope="col" className={s.num}>Time per question</th></tr></thead>
              <tbody>
                <tr><th scope="row">Relaxed SIMD, 4 threads</th><td className={s.num}>26 ms</td></tr>
                <tr><th scope="row">Relaxed SIMD, 1 thread</th><td className={s.num}>54 ms</td></tr>
                <tr><th scope="row">SIMD, 1 thread</th><td className={s.num}>74 ms</td></tr>
                <tr><th scope="row">Scalar, threads</th><td className={s.num}>113 ms</td></tr>
                <tr><th scope="row">Scalar, 1 thread</th><td className={s.num}>314 ms</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            WebAssembly memory is about 105 MB single-threaded and 201 MB with threads. Older devices fall back to the
            slower builds automatically; the answer is identical, only the time changes.
          </p>
          <LiveStats />

          <h2 id="lessons">Challenges and lessons</h2>
          <ul>
            <li><strong>Teaching &ldquo;I don&rsquo;t know&rdquo; directly failed.</strong> Training the model to answer &ldquo;unknown&rdquo; at the answer position did not learn. Checking each step instead worked.</li>
            <li><strong>Models find shortcuts.</strong> One version learned that &ldquo;extra people&rdquo; meant a made-up chain. Adding wrong chains to clean stories removed the shortcut.</li>
            <li><strong>Search fools a verifier.</strong> Beam search is good at finding chains that slip past the step checker. Mining those chains as training data fixed it.</li>
            <li><strong>Small machines need care.</strong> Mining 512 questions at once used 7.7 GB on an 8 GB laptop; batches of 64 kept training stable.</li>
            <li><strong>Position matters.</strong> The name model failed on short texts it had never seen at that length; training on short snippets cut that error from 52% to 6.7%.</li>
          </ul>
          <div className={s.placeholder}>
            <strong>Placeholder: training curves</strong>
            Add a chart of training loss and validation accuracy from the run logs if you want to show the learning process.
          </div>
          <p>
            Source code: <a href={SOURCE_URL} rel="noopener noreferrer">{SOURCE_URL.replace('https://', '')}</a>
          </p>
        </article>
      </div>
    </main>
  );
}
