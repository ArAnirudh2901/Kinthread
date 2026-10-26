# Kinthread

**Blood-relation puzzles, solved step by step.** Live at **https://kinthread.pages.dev**

Kinthread reads a short family story, or a textbook question like *"A is the brother of B. C is the father of A. How
is C related to B?"*, and works out how two people are related. It shows the working the way you would write it on
paper: one fact at a time, drawn as a family tree, ending in the answer.

Production currently uses the v8, 13M-parameter relation model and its 5.1M name finder. Both run **entirely in your
browser**. Your story never leaves your device; there is no inference server, account or API key. This checkout also
contains an in-progress v10-r8p browser candidate; it is not production-ready yet.

The active Cloudflare Pages deployment is still v8. The v10-r8p candidate now passes a three-link browser answer
smoke check in Chrome on local runtime `f608eed15e9b`: the expected “paternal cousin” was shown as a tentative
`assumed` result (uncalibrated score 0.95) in 9.6 seconds on this device, using two WebAssembly threads. This is one
question, not broad parity or an accuracy estimate. The Node/Pyodide integration regression also passes. The locked
test remains 68.8% fair / 72.2% verified, below the 85% target; keep v8 in production until broad parity, accuracy,
calibration, and device-performance gates pass. See [the migration plan](MODEL_UPGRADE_PLAN.md).
See [the migration plan](MODEL_UPGRADE_PLAN.md) for Cloudflare behavior and release gates.

<p align="center">
  <img src="docs/map-dark.png" alt="Worked answer: Victor's father George, George's wife Helen, Helen's daughter Rose, so Rose is Victor's sister" width="49%">
  <img src="docs/map-exam-light.png" alt="Exam question: A is the brother of B, C is the father of A, so C is B's father" width="49%">
</p>

<p align="center"><sub>Maps saved with the site's own Download button: a story in the dark theme, and a pasted exam question in the light theme.</sub></p>

---

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Running it locally](#running-it-locally)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deploying](#deploying)
- [Performance](#performance)
- [Browser support](#browser-support)
- [Limits](#limits)
- [Related](#related)
- [License](#license)

## What it does

1. **Write a family story**, or paste an exam question as it is. Kinthread finds the question ("How is C related to
   B?", "What is C to B?", "C is related to B as?"), ignores multiple-choice options, and treats single letters as
   names.
2. **Pick two people.** The question itself is the picker, *"How is [ ] related to [ ]?"*: tap a blank, then a name.
   As soon as both blanks are filled, it solves.
3. **See how they're related.** The map rebuilds as a family tree, with parents above and children below, and plays
   the reasoning one step at a time:
   - **white chalk** for the question: a dashed arrow with a "?";
   - **blue chalk** for facts from the story, numbered in reasoning order, each quoted from the sentence it came from;
   - **yellow chalk** for the answer: the thread that replaces the question (on the light theme, a yellow
     highlighter under the answer line).

   People are drawn as in biology pedigree charts: squares are male, circles female, and a diamond means the story
   never says. A caption narrates each step ("So Helen is Victor's father's wife, which makes Helen Victor's mother"),
   and you can pause, step back, or jump to the answer.

Kinthread also:

- **saves the map as an image** (PNG) for notes or sharing, made on the device;
- **shares a question as a link**: the story travels in the URL's `#hash`, which is never sent to a server, and the
  link opens the question already solved;
- **notices a story that contradicts itself** (someone called both a son and a sister, a person who is their own
  relative, two people each the other's parent) and says so before you trust the answer;
- **lets you undo Clear** for a few seconds;
- **says when it can't tell** rather than guessing: unrelated people get "no family link", and low-confidence answers
  are labelled a best guess;
- **checks itself:** fixed kinship rules ("a father's wife is a mother") recompute the answer from the model's own
  steps and flag any disagreement;
- **works offline** after the first visit, in a dark or light theme.

## How it works

```text
your story ──► name model ──► names become entity ids (@0, @1, …)
                                   │
                                   ▼
               relation transformer writes the chain of facts
               ("@0 father @1", "@1 wife @2", "@2 daughter @3")
               with a constrained beam search, then the answer
                                   │
                                   ▼
       kinship rules re-check the chain ──► worked map, step by step
```

- **Names to ids.** Before the relation model reads the story, every name becomes an entity id, so it learns
  relationships from the wording ("her son", "his sister"), not from what names usually mean.
- **Chain of thought.** The model writes the family facts along the path from one person to the other before
  answering. The search may only pick relation words and people that appear in the story, and a step checker,
  trained on deliberately wrong chains, lowers the weight of facts the story doesn't state.
- **Knowing when to stop.** If the two people are never mentioned together, or through people who are, it answers
  that the story doesn't link them, without running the model.
- **In the browser.** Both models run in a Web Worker on a small engine written in C and compiled to WebAssembly,
  with SIMD and several threads when the browser allows. Weights are the original 32-bit floats, not quantized, and
  outputs match the PyTorch reference to within 1.5 × 10⁻⁵. Every model file is checked against a SHA-256 checksum
  before it is stored, and again (CRC-32) each time it loads.

The site's *How it works* and *Build log* pages go deeper, including how the models were trained and evaluated.

## Running it locally

Requirements: [Bun](https://bun.sh) 1.3+ (package manager and script runner) and Node.js 20.11+ (the build scripts and tests run on Node). The model is included (see below).

```bash
git clone https://github.com/ArAnirudh2901/Kinthread.git
cd Kinthread
bun install
bun run dev          # http://localhost:3000
```

### Model files

`vendor/kinship/` holds the current v8 runtime/model plus the selected v10-r8p export and browser runtime. `bun run sync`, which runs
automatically before `dev` and `build`, checks every file's size and SHA-256 against `vendor/kinship/manifest.json`
and stops if anything differs. `.gitattributes` marks the folder binary, so git never changes a byte (no line-ending
conversion, on any OS). Don't use Git LFS for this folder.

At runtime, the app reads the no-cache `/model-release.json` from the active Pages deployment. The manifest includes
the human release ID, model descriptor, and content-hashed worker/model paths. A returning browser can download a
newer compatible release in place; cached and downloaded model files are checked by size and SHA-256. The previous
model cache is removed only after the replacement initializes and is fully cached. A build now fails if the release
manifest is missing from the Cloudflare Pages export.

Maintainers with the model project ([LLM-From-Scratch](https://github.com/ArAnirudh2901/LLM-From-Scratch)) checked
out at `../../Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM` (or `KINSHIP_SRC`) sync from it instead; a changed
model refreshes `vendor/kinship/`, to be committed. Either way the files land in hashed folders (`public/r/<hash>/`,
`public/m/<hash>/`), so a new model can never be mixed with old code.

### Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | development server (single-threaded: the dev server can't send the isolation headers) |
| `bun run build` | sync, then a static export to `out/`, then `postbuild`: `_headers`, per-page CSP, service worker |
| `bun run preview` | serves `out/` with Cloudflare's runtime and headers at http://localhost:8788 |
| `bun run test` | unit tests, plus model tests when the model files are present |
| `bun run check` | lint + tests + build |

## Project structure

```text
src/
  app/                    pages: home, how-it-works, limits, build-log (Next.js App Router, static export)
  components/
    workbench/            step 1 story editor and examples; step 2 question picker; Solve button
    map/                  step 3: live map, worked solution, step caption and controls, results, model loading
    home/, layout/, content/, three/, brand/
  lib/
    exam.js               exam-question input: finds the question, letters as names, rewording for the model
    relations.js          kinship composition rules ("father's wife" = mother) and evidence lookup
    worked.js             the worked answer as sentences
    solution-layout.js    family-tree layout by generation, collision-free labels and answer arc
    graph/engine.js       force layout for the live map (one GSAP ticker callback)
    export-image.js       map to PNG, with fonts and styles inlined
    gl/constellation.js   hero 3D scene in raw WebGL
    model/client.js       talks to the worker; asks before the first download (window: `map/ModelGate.jsx`)
runtime/
  worker.js               inference worker: model cache, checksums, both models
  sw.js                   service worker template (offline shell)
scripts/                  sync-runtime.mjs (model files), postbuild.mjs (headers, CSP, service worker)
tests/                    node tests (story, rules, layout, exam input, force layout, real model)
tools/                    WebGPU benchmark, browser test harness
```

`AGENTS.md` is the maintainer's handbook: decisions, constraints and open items, kept current for anyone (or any AI
agent) picking up the work.

## Testing

```bash
bun run check
```

- **Unit tests:** the story reducer, kinship rules, exam-question parsing, force layout, and the solution layout.
  The layout test checks 735 chain shapes at phone and desktop widths for overlapping labels.
- **Model tests** run the real WebAssembly runtime in Node: checksums of every model part, the outcome of every
  example on the site, and exam-style questions.
- **Browser harness** (`tools/harness/`): `node tools/harness/server.mjs` serves the build with production headers;
  `/__solve.html` drives every example at desktop and phone widths and checks for overlaps, step controls and the
  light theme; `/__export.html` checks the image download. Results go to `tools/harness/result.jsonl`.

## Deploying

The site is a static folder (`out/`) on Cloudflare Pages at https://kinthread.pages.dev, deployed by direct upload:

```bash
bunx wrangler whoami   # must be the account that owns the kinthread project
bun run deploy         # build, then wrangler pages deploy out --project-name kinthread --branch main
```

The project was created once with `bunx wrangler pages project create kinthread --production-branch main`. Recent
wrangler versions turn that command into a Workers project (a longer `*.workers.dev` address) when an AI agent runs
it; `--force` keeps classic Pages. `SITE_URL` (default `https://kinthread.pages.dev`) sets the address used in link
previews, `robots.txt` and `sitemap.xml`.

The build already handles:

- **Threads:** `_headers` sends `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`, which multi-threaded WebAssembly needs. Without them the
  single-threaded engine runs automatically, about 2× slower.
- **File limits and dropped connections:** weights are split into 2 MiB parts (Cloudflare allows 25 MiB per file).
  Pages ignores HTTP Range, so a dropped connection re-downloads only the parts in flight (at most 6 MiB).
- **Caching:** hashed folders are immutable for a year; pages and the service worker revalidate.
- **Security:** each page carries a Content-Security-Policy with the exact hashes of its inline scripts, plus
  `X-Frame-Options: DENY`.
- **Sharing and search:** a 1200×630 preview image, an Apple touch icon, `robots.txt` and `sitemap.xml`.

## Performance

- About **26 ms per question** on an Apple M2 in Chrome (relaxed SIMD, 4 threads). The matrix-multiply tiles and the
  thread count are tuned on each device when the model loads.
- **One-time download** of 63.9 MB; later visits load from the device in about a second. A first visit opens a window that
  asks before the download and shows its progress; returning visitors load straight from the device.
- **WebAssembly, not WebGPU:** `tools/bench-webgpu.html` runs the model's real per-step workload both ways. On an
  M2, a WebGPU step took 5–17 ms against 1.6–1.9 ms for WebAssembly, plus about 0.9 s of GPU setup, because beam
  search reads results back after every small step.
- Animation runs on GSAP with transforms and opacity only; the live map sleeps when settled, and the 3D scene pauses
  off screen and is loaded after the page is interactive.

## Browser support

Chrome and Edge 80+, Firefox 114+, Safari 15+. The page picks the fastest engine the browser supports (relaxed SIMD,
SIMD or scalar, with or without threads). Tested in Chrome and Safari on macOS, at widths from 320 to 1440 px.

## Limits

- **English stories with named people**, written in the third person ("Ashley's daughter Lillian…", not "my mom").
- **About 280 words** per story.
- **Eighteen relationships**: parents, children, siblings, grandparents, grandchildren, uncles and aunts, nephews and
  nieces, and in-laws. Short chains of two to four steps are the most reliable.
- **Exam formats not supported yet:** spoken-clue puzzles ("Pointing to a photograph, A said…") and coded relations
  ("A + B means…"). Long "X is the son of Y" chains often come back as a best guess.
- **Friends and coworkers** are the hardest case: the model can mistake them for family.

The site's *Limits & tips* page explains each one, with examples.

## Related

- [LLM-From-Scratch](https://github.com/ArAnirudh2901/LLM-From-Scratch): the transformer, training code and browser
  engine behind Kinthread.

## License

[Apache License 2.0](LICENSE).
