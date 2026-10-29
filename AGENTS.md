<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kinthread: handbook for any agent or model

Keep this file current. Whenever a decision, command, constraint or open item changes, update it here (and the
Claude memory noted in CLAUDE.md), so the next model can continue cold. Add a line to the handoff log at the end.

## Related repos

| Repo | Local path | Holds |
| --- | --- | --- |
| [Kinthread](https://github.com/ArAnirudh2901/Kinthread) (this) | `~/Web_Dev/kinthread` | the website + final model in `vendor/kinship/` |
| [Kinthread-llm-model](https://github.com/ArAnirudh2901/Kinthread-llm-model) | `~/Generative_AI/Kinthread-llm-model` | model code (create, train, test, export), checkpoints, data, exported model |
| [LLM-From-Scratch](https://github.com/ArAnirudh2901/LLM-From-Scratch) | `~/Generative_AI/LLM_from_Scratch` | the whole learning project; canonical source of the model code (`2_Training_Tiny_LLM`) |

Model change flow: retrain/export in LLM-From-Scratch, then `bun run sync` here (refreshes `vendor/kinship/`; commit it),
and publish the model repo (see its AGENTS.md).

Pushing: if `gh` is signed in as someone else, authenticate the single push as the owner:
`git -c credential.helper= -c 'credential.helper=!f() { test "$1" = get && echo username=ArAnirudh2901 && echo "password=$(gh auth token --user ArAnirudh2901)"; }; f' push`

## What it is

Static Next.js 16 site, "Kinthread: blood-relation puzzles, solved step by step". It runs the owner's from-scratch
kinship QA models (a 13M-parameter relation transformer and a 5.1M name tagger) entirely in the browser:
WebAssembly in a module worker, no server. Users: Class 10 and competitive-exam students solving blood-relation
questions, parents and teachers, curious visitors on phones. Renamed from "Kinship QA" on 2026-10-20 (the folder was
`~/Web_Dev/kinship-qa`; storage keys are `kinthread-*`).

The models come from the LLM repo, `~/Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM` (`web/`: engine.c,
kinship.js, six WASM builds, model files; see that repo's AGENTS.md). `bun run sync` copies them into
`public/r/<hash>/` and `public/m/<hash>/` after SHA-256 checks (generated, not committed; `KINSHIP_SRC` overrides).
Without the LLM repo (a fresh clone) it uses the committed copy in `vendor/kinship/` (final model + runtime, 59 MB,
`binary` in .gitattributes, every file SHA-256-checked against its manifest.json). After a model change, sync from the
LLM repo refreshes `vendor/kinship/`; commit it. No Git LFS. Training/eval Python files are not in this repo (owner
will decide later).

## Owner's hard rules

- Deploy only when the owner asks, and only after `bunx wrangler whoami` shows the owner's own Cloudflare account
  (wrangler on this Mac was once logged in to someone else's; if it is not the owner's, stop and ask them to run
  `bunx wrangler login`). Live: https://kinthread.pages.dev (classic Pages project `kinthread`, branch `main`).
  Deploy with `bun run deploy`; never pass `--force` to a deploy of an existing project, and never delete it.
- Cloudflare Pages serves a static `out/` snapshot per deployment; there is no model database entry to delete.
  `model-release.json` must be generated before the build and included in each snapshot. Its `_headers` rule forces
  no-cache revalidation, and `runtime/sw.js` fetches it from the network. A 404 means the active deployment lacks the
  manifest; publish a correct full snapshot after the v10 answer-pipeline gate passes.
- Commit only when asked; never push unless asked. Repo: https://github.com/ArAnirudh2901/Kinthread (public,
  Apache-2.0, branch `main`), checked out at `~/Web_Dev/kinthread`. It is hidden from the parent `~/Web_Dev` repo (the owner's other
  projects) through `~/Web_Dev/.git/info/exclude`: never commit Kinthread into `~/Web_Dev`.
- Before any `gh` command or push, run `gh auth status`: only act as the owner's account (ArAnirudh2901). If another
  account is active, authenticate that one command with the owner's token or ask the owner to switch; don't switch
  accounts for them.
- No quantization, no smaller or distilled model: exact fp32 weights. Weights live only in `vendor/kinship/` here and
  in Kinthread-llm-model.
- Commits are authored as `Anirudh Aravalli <anirudh30012005@gmail.com>` (ArAnirudh2901; set in this repo's git
  config). Never add `Co-Authored-By: Claude` or `Claude-Session` lines: only ArAnirudh2901 may appear as a contributor.
- Test in the owner's real Google Chrome through the Claude-in-Chrome extension. Reuse the tab already open (navigate
  it); open another only when truly needed, never close/reopen per test, never `open -a` a URL. Long runs: start the
  self-running harness page once, then wait with ONE background shell command on `tools/harness/result.jsonl` (no
  polling loops). A hidden tab pauses animation frames: ask the owner to keep it in front. Safari: one tab, closed after.
- Keep token use lean: combined shell calls, short output, no re-reading files or images already seen.
- Improve without breaking: change only what a test or a look proves wrong, keep fixes small, re-run the same checks.
- Production quality; think as the student using it; suggest improvements and flag risks unasked.
- Code comments brief (constraint or reason only). Docs and UI copy in plain English.

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | dev server (runs sync first) |
| `bun run build` | sync, `next build` (static export to `out/`), `scripts/postbuild.mjs` (_headers, per-page CSP, sw.js) |
| `bun run check` | lint + all node tests + build: run before reporting work as done |
| `bun run test` | node tests only (`tests/*.test.mjs`, includes the real model) |
| `bun run preview` | `wrangler pages dev out` on :8788 (local only) |
| `bun run deploy` | build, then `wrangler pages deploy out --project-name kinthread --branch main` (owner's account only) |
| `node tools/input-compare/compare.mjs [out] [tier] [variants]` | v10 input comparison on the page examples + `tools/input-compare/questions.json` through the synced Node/Pyodide pipeline (accuracy, latency, paired wins); `--report run.jsonl` re-summarises a run |
| `node tools/harness/server.mjs` | serves `out/` on :8791 (COOP/COEP, no X-Frame-Options, HTTP Range) for the browser harness; `SLOW=<ms per MB>` or `POST /__profile` (network simulator) throttle model downloads |

## Map of the code

| Area | Files |
| --- | --- |
| Pages | `src/app/` (home, how-it-works, limits, build-log, 404); `layout.js` has metadata and the pre-paint theme script |
| Workbench (steps 1–2) | `src/components/workbench/`: StoryEditor, Examples, PeoplePicker (question with two blanks), TraceBar (Solve button), Workbench (state wiring), `state.js` reducer |
| Map (step 3) | `src/components/map/`: MapPanel, StoryGraph (live force map and worked solution), StepCaption (narration and controls), Solution (folded step list), ResultView (Headline above the map plus result views), ModelLoading, ModelDetails |
| Logic | `src/lib/`: `exam.js` (exam-question input), `relations.js` (kinship composition rules), `worked.js` (step sentences), `solution-layout.js` (generation-tree layout), `graph/engine.js` (force layout), `export-image.js` (PNG), `story.js`, `examples.js`, `kinds.js` |
| Model client | `src/lib/model/client.js` (worker, `modelOnDevice`), `runtime/worker.js` (cache, checksums, inference) |
| Loader | `map/ModelGate.jsx` (full-screen window: first visit or any network download), `map/Weave.jsx` (WeaveStage, DownloadStatus, AskCopy: one design for window and panel), `lib/progress-follow.js` + `lib/useFollowedProgress.js` (the progress algorithm), `lib/constellation-graph.js` `buildNeuralCone` |
| Share / undo / checks | `lib/share.js` (#hash links), `lib/consistency.js` (contradictions), undo in `Workbench.jsx`, `components/ErrorBoundary.jsx`, `app/error.js` |
| 3D | `src/lib/gl/constellation.js` (raw WebGL, lazy; hero and loader both draw the neural cone: hero fully woven, loader weaves with the download) |

## Product decisions (don't undo without asking the owner)

- Dark theme by default, light optional (View Transitions circle reveal). "Chalkboard" palette (green-black board, chalk-white text, yellow-chalk answer and accent, blue-chalk facts, white-chalk question; light theme = exam paper with an ochre answer over a yellow highlighter; no orange/cream/violet/indigo; see DESIGN.md; tokens are role-named: `--answer`, `--answer-fill`, `--on-answer`, `--fact`, `--question`) in `globals.css`.
- Three numbered steps: Write a family story / Pick two people / See how they're related.
- The picker is the question: "How is [ ] related to [ ]?". Blanks fill in reading order (B, the person described,
  first; then A, the reference). Choosing both people, or swapping, solves at once. The button says "Solve".
- No A/B role letters anywhere in the UI (they clashed with exam questions that name people A, B, C).
- Colours: white chalk = the question (dashed arrow with "?"), blue chalk = facts (numbered, quoted from the story),
  yellow chalk = the answer. Pedigree shapes: square male, circle female, diamond not stated. Rows are generations.
- Above the map: the question, which becomes the answer. Under the map: step caption and controls, then legend and
  Download. The full step list is folded. The last caption shows the working ("Victor's father's wife's daughter is
  Victor's sister").
- Jargon (engine, agreement, timings, tokens) only inside "Model details".
- The model window (`ModelGate`, native `<dialog>`) opens only when something asks for the model (Solve, an example,
  Download; `lib/model/gate.js` `requestModel(el)`): it grows out of that control as one shape (clip-path inset on a
  spring, the control's colour and label fade/blur out, the weave blurs in) and shrinks back into it when ready; the
  solve then runs in view. Solve stays enabled before the model exists, with a note on the one-time size. Returning
  visitors (`modelOnDevice()`) load silently with no window.
- Exam input (`exam.js`): the pasted question is detected and fills the picker. v10 reads the text as written,
  question and answer options included (`readerInput`; `kinlogic.prepare`/`exam` find people, question and options, the
  input `eval.run_real` measured): a pasted question about other people is dropped with its options, and when the
  reading does not ask about the picked pair the pipeline adds the picker's question and reads again. v8 only: the
  question and options are removed, single letters count as names, "X is the R of Y" is reworded to "Y's R X was
  there" (`forModel`). The user's text is never changed. Spoken-clue puzzles get a "not supported" tip.
- PNG download of the map: computed styles and fonts inlined; `data-*` attributes stripped (`data-key` holds a NUL).
- Loader: a neural-network cone (1/3/6/9/12 neurons, straight cone sides, adjacent layers fully connected). Woven
  threads and reached neurons turn red, spreading layer by layer from the apex; waiting ones are neutral grey; the
  answer path down one side is brightest. Weave and the big percentage read ONE value from the progress follower
  (never ahead of the bytes, never backwards, < 1% per frame so no percent is skipped, exact 100%); "100%"
  cross-fades into "Ready", then the window closes. Downloads resume after a dropped connection (Range; waits
  1/2/4/8/15 s, "Connection lost, reconnecting…"); only then does the error screen show.
- Share link (story in the #hash only, never sent to a server), undo for Clear (8 s), contradiction warning in the editor.
- Motion system: springs as CSS `linear()` (`lib/motion.js` `springEasing`, damping 0.82, ~1% overshoot, no bounce);
  `lib/useShapeMorph.js` morphs a control's size between states with its new content blurring in (Download: pill ->
  loader -> check -> pill; Share; Clear -> undo toast with a draining bar; Solve -> loader circle when slow; header
  status pill; add-name field; guidance under Solve); `lib/fly.js` sends a tapped name chip into its blank and crosses
  the two names on Swap; `lib/liquid.js` slides one nav underline between links (each edge on its own spring, the
  leading edge stretches); play/pause icons morph (CSS `d`); headline, caption and step number swap with a short blur;
  `<details>` open with `interpolate-size` where supported.
- Smooth scrolling: Lenis (`lib/smooth-scroll.js`) for wheel/trackpad only, driven only while moving; touch and
  reduced motion keep native scroll; code scrolls through `scrollToTarget`; the model window holds the page still.
- Live map (before solving): each mentioned-together pair is asked both ways; a confident relation becomes a labelled
  blue arrow (the direction the story states in words, so no guessed gender); the rest stay dashed.
- Neural cone (hero and loader): soft yellow wash with the answer path brightest (owner's pick of four).
- GSAP 3.15 for motion (Motion was removed). WebAssembly, not WebGPU: WebGPU measured 3–9x slower per beam step.

## Cross-browser constraints

- No regex lookbehind (Safari before 16.4 fails to parse the whole bundle). No `color-mix()`. `100vh` fallback
  before `dvh`. Avoid `Object.hasOwn`.
- Per-page CSP: `connect-src 'self'`, `img-src 'self' data:` (blob: fetch is blocked; only test code cares).
- Threads need COOP/COEP (`_headers`). Supported floor: Chrome/Edge 80+, Firefox 114+, Safari 15+.

## Testing

- `bun run check` must pass (130 tests on 2026-10-20). Highlights: solution layout (735 chain shapes at phone and
  desktop widths), real model runtime on every example and exam question, progress follower (7 durations 0.2 s-10 min
  x 30/60/120 fps x steady/bursty/jitter/spikes/stalls/latency), cone geometry, contradictions, share links.
- Browser harness: start `node tools/harness/server.mjs`, then open `http://127.0.0.1:8791/__solve.html` (every example at 1200 and 380 px,
  overlaps, controls, light theme) or `__export.html` (exam example plus PNG download in dark and light, 375 px) in
  the single extension tab. Results append to `tools/harness/result.jsonl`. Expected controls sequence:
  `[3, 0, 2, 3, 0, 4, 1, 0, 4, 3]`. "typed long chain" answer-tag opacity 0 is sampling timing (the tentative
  answer fades in just after the last step).
- `/__loader.html`: the real loading window under 13 network profiles via the simulator (`POST /__profile` with
  `{ mbps | schedule: [[s, mbps]...], rtt, jitter, stallEveryMB, stallMs, skip, dropAtMB }`); every frame checks weave
  = number, never ahead, never backwards, no skipped percent, one canvas. Last run: all zero. Takes ~11 min.
- Responsive: no page overflow from 320 to 1440 px on every page; the solved map fits without scrolling from 360 px.

## Known limits and open items

- The model is unsure on long "X is the R of Y" chains (shown as a best guess). Coded relations ("A + B means…")
  and spoken-clue puzzles are not supported.
- At 320 px the solved map scrolls sideways inside its box.
- Touch fixes and the loader were seen on the owner's phone (Android Chrome, plain HTTP preview); Safari/iOS on a real
  device not checked. Slow 3G/2G live runs cover the start and the final stretch, not a full 20-minute download.
- The build-log page has two marked placeholders for the owner's own words.
- Cloudflare Pages ignores HTTP Range: a dropped connection re-downloads the in-flight 2 MiB parts (worker handles it).

## Handoff log

- 2026-10-19: site built (Next 16 static, worker + WASM, GSAP, live force map, WebGL hero, theme switch), WebGPU
  benchmarked, Chrome and Safari tested.
- 2026-10-20: worked-solution map (relations rules, generation layout, step playback), phone fit, PNG download,
  responsive sweep, renamed to Kinthread, UX simplification for students, exam-question input, harness moved to
  `tools/harness/`. Published to GitHub (README with map images, model tests skip on a fresh clone).
- 2026-10-20: final model committed in `vendor/kinship/` (binary, SHA-256 manifest; checked on normal, autocrlf,
  shallow and ZIP clones). History rewritten so only ArAnirudh2901 is a contributor. Model repo Kinthread-llm-model
  created; LLM-From-Scratch `main` now includes the kinship project.
- 2026-10-20: npm → Bun (bun.lock migrated, same versions). Design/QA pass with the Emil/Apple/mobile skills: every
  `:hover` gated behind `(hover: hover) and (pointer: fine)`, transparent tap highlight, no text selection on controls,
  16px minimum input font, theme-color follows the page theme, hero 3D camera fitted to the canvas aspect (graph never
  clipped), no row labels in the compact map layout, full-name `<title>` on truncated map names.
- 2026-10-20: map no longer "refreshes": an edited story keeps its last answer on screen, dimmed under the stale
  banner, with no replay until Solve; live mode clears inline styles a worked-answer timeline left (a person could
  stay hidden). Hero spin decays and its light fades, then the render loop sleeps (0 rAF at rest); pointer wakes it.
  Press feedback on every control.
- 2026-10-20: unique "Red thread" palette from natural dyes (indigo ground and question, weld gold facts, madder red
  answer/accent, undyed wool text), role-named tokens, logo redrawn in the map's language (gold square/circle facts,
  indigo question diamond, red answer thread and node), favicon to match; README images recaptured.
- 2026-10-20: PRODUCT.md (confirmed product truth) and DESIGN.md (Red thread system) added; animation audit plans in
  `plans/` (all DONE); dev-only worst-case toggle (`?data=worst|exam|one|many|long|empty`, `src/lib/fixtures.dev.js`,
  excluded from production); fixed maps being squeezed below readable scale on phones (`max-width` on the SVG): they
  now scroll sideways with a faded edge.
- 2026-10-20: loading weave eases toward the download progress and grows each thread from person to person (no
  sudden edges); first-visit window (`ModelGate`) replaces the phone-only prompt.
- 2026-10-20: model window redesigned: full-screen on phones, large panel on desktop; wordmark top-centre; the whole
  family shows faint and weaves in as bytes arrive (weave fills the stage); large tabular percentage + "Downloading the
  model"; shows "Ready" then closes (first-visit flag latched per page load). Mark: only threads animate (diamond was
  dashed). Harness: `SLOW=<ms per MB>` throttles model parts to see loading locally.
- 2026-10-20: one loading design everywhere (`map/Weave.jsx`: WeaveStage + DownloadStatus + AskCopy), used by the
  full-screen window on every device and by the map panel; the window also opens for any real network download
  (cache cleared/unavailable), not only first visits; quick loads from the device show nothing.
- 2026-10-20: share link (`lib/share.js`, #hash only, validated, phone share sheet / clipboard with timeout and a
  copy-by-hand fallback), undo for Clear (8 s), contradiction check (`lib/consistency.js`: gender clash, self relation,
  parent cycle; tests in `tests/consistency.test.mjs`), error boundary around the map + `app/error.js`, story capped at
  6000 characters.
- 2026-10-20: loader weave reworked after a phone recording: breadth-first weave order from the top ancestor (each
  thread starts at someone drawn), steady pace (<= one full weave per 5 s, never ahead of the download), people bloom
  in as their thread arrives, "Ready" and closing wait for the weave to complete (`onWoven`).
- 2026-10-20: loader weave = download progress exactly (worker reports every ~32 ms, no pacing or smoothing, set
  before paint); verified: weave 1.000 when the download completes, never steps back, one canvas instance (no reload).
- 2026-10-20: loader weave colours: woven threads and reached people turn red (a red network grows from the first
  person); threads still to come are neutral grey (`buf.lg`/`buf.pg`); the answer path stays brightest and thickest.
- 2026-10-20: loader progress algorithm `lib/progress-follow.js` (critically damped follower of bytes/total: never
  ahead, never backwards, smooth, exact 100%), one value for weave and number (`useFollowedProgress`), "100%"
  cross-fades into "Ready"; property tests `tests/progress-follow.test.mjs`; live check: 496 frames, 0 mismatches.
- 2026-10-20: progress follower caps each frame below 1% (no skipped percent at any speed/fps). Tests: 6 durations
  (0.5 s-10 min) x 30/60/120 fps x steady/bursty/jitter/stalls/latency. Harness network simulator: POST /__profile
  {rate KB/s, jitter, stallEvery KB, stallMs, latency}; `/__loader.html` runs 6 real profiles: all 0 mismatches.
- 2026-10-20: loader is a neural-network cone (`buildNeuralCone`: 1/3/6/9/12 neurons on rings, radius proportional
  to depth, adjacent layers fully connected, red path down one side; tests/cone.test.mjs). Worker resumes dropped
  downloads (Range, waits 1/2/4/8/15 s, "Connection lost, reconnecting…"); harness server supports Range. Live suite
  (13 profiles incl. spikes, 200 Mbps, connection drop): 0 mismatches/ahead/backwards/skipped, one canvas each.
- 2026-10-20: handbook refreshed (testing workflow, code map, loader decisions, test counts); all three repos pushed.
- 2026-10-20: deployed to https://kinthread.pages.dev (owner's Cloudflare account; classic Pages via `--force` on
  project create, because wrangler turns agent-run Pages commands into a Workers project with a longer URL). Model
  parts 16 MiB -> 2 MiB (Pages ignores Range); model folder version now hashes the served parts (a part-size change
  used to reuse the old folder); `check` syncs before testing; `bun run deploy`; robots.txt, sitemap.xml, 1200x630
  share image (JPEG, 95 KB), Apple touch icon. Live: all served files byte-identical to out/.
- 2026-10-20: live-test fixes: loader label stayed "Checking" while the weave finishes (it fell back to
  "Downloading" once the model was ready; harness now checks the label never steps back); GSAP no longer gets empty
  targets (optional map parts, empty live map), so the console is clean. Live: 14 network profiles all zero, solve
  harness clean, real first visit 61.4 MB in ~14 s, returning visit ready in 0.56 s, all served files byte-identical.
- 2026-10-20: palette replaced: "Red thread" (red-orange + cream read as Anthropic) -> "Chalkboard" (owner picked it
  from a side-by-side of three; rani-pink/peacock was tried first and rejected). Tokens only change in globals.css;
  literal copies in lib/gl/constellation.js, icon.svg, apple-icon.png, opengraph-image.jpg, layout.js theme-color,
  docs/map-*.png. `--answer-rgb` / `--answer-tint` replace hard-coded tints. Harness: server no longer crashes when
  the profile is reset mid-download; `__export.html?example=&width=&themes=&keep=1` returns PNGs (README images).
- 2026-10-20: impeccable polish pass (detector 101 -> 0 findings): `--fs-*` type ramp and `--radius-xs` (DESIGN.md
  documents both; map SVG text keeps px sizes because lib/measure.js lays it out); stale old-indigo/gold rgb() tints
  -> `--question-rgb`/`--fact-rgb`; no eyebrows (hero subtitle joins the lede, PageIntro `meta` replaces `eyebrow`),
  no tiny uppercase mono labels (sentence-case 13px UI font; mono only for data: tokens, tags, numbers, code), no
  coloured side bars, status pill after the headline, no bounce (`--spring` removed; map pops power3/expo from 0.85),
  selection/caret/accent/scrollbar themed. Solve harness and loader checks clean.
- 2026-10-20: hero now shows the neural cone too, fully woven in the answer colour (yellow chalk; ochre on light),
  with pulses down the answer path; the old family-constellation graph and its test are gone. ESLint `no-undef` on
  (a removed variable had blanked the WebGL scene at runtime without failing lint).
- 2026-10-20: Lenis smooth scrolling; model window opens from Solve/example/Download and morphs from and back into
  that control (gate.js, ModelGate); shape-morph motion system (motion.js, useShapeMorph, fly) on Download, Share,
  Clear/undo, Solve, header status, picker, play/pause, caption blur; live-map links labelled with model relations
  (asked both ways); cone soft yellow; How it works copy names the Chalkboard colours.
- 2026-10-20: morphs added on the most-used path (nav underline, headline/caption/counter blur swaps, Swap cross-over,
  guidance line, disclosures, add-name). Loader suite 14/14 clean on this build; solve harness clean.
- 2026-10-20: trackpad reversal fix (Lenis virtualScroll drops queued distance on reversal, caps it at 0.8 screen);
  theme toggle hover tracked by pointer events (the reveal took :hover away); PNG export states the question at the top
  and the answer at the bottom; light-theme cone stronger (ink on paper does not add up).

- 2026-10-26: began the selected v10 reader website migration (see `MODEL_UPGRADE_PLAN.md`): added an exact-fp32
  reader exporter to the canonical LLM repo; first export from v10-r8p step 6,000 is 39.50M weights / 158.0 MB
  raw / 126.1 MB gzip with a SHA-256 manifest. Not yet wired to browser inference or deployed. Added hardware-aware
  runtime tiers in this site: low (single WASM thread, serial file downloads), balanced (2 threads/downloads), high
  (4 threads/3 downloads), plus reuse of the existing lite WebGL mode on low-tier hardware. `bun run check`: lint,
  130 tests, and static build passed. V8 remains deployed until v10 parity and device budgets are proven.
- 2026-10-26 (continued): canonical LLM source now includes a v10 WASM forward prototype (`reader_engine.c`, `reader.js`), SIMD and scalar builds, and PyTorch golden scripts. One short-prefix/cached-decode check matched within 1.15e-5 max absolute difference for prefix/decode hidden states, tied logits, copy keys and mixed probabilities. This is prototype parity only; website integration and 50-prompt/browser/mobile checks remain.
- 2026-10-26 (continued): exported the selected checkpoint with `FINAL.json`, `verifier.json`, and `name_table.tsv.gz` to `/tmp/kinthread-v10-final`; export integrity manifest generated. The first Chrome harness attempt rendered blank and produced no result; later direct Chrome checks verified the local website flows (see the final Chrome verification entry below). `bun run check` passed at this milestone (130/130 tests, lint, static build). Published the resource-aware v8 site update to Cloudflare Pages from the owner's account: https://af2acf01.kinthread.pages.dev (production branch `main`). The v10 runtime is not included.

- 2026-10-26 (continued): v10 SIMD/scalar C/WASM primitive parity now passes 50 generated prompts (13–101 tokens) versus PyTorch; maximum differences range from 1.38e-5 decode to 7.82e-5 mixed probabilities. It still does not test the JS wrapper, beam search, Python kinlogic, or the browser answer UI. The deployed site remains v8 at `https://kinthread.pages.dev`; keep v10 private until full pipeline and device checks pass.

- 2026-10-26 (continued): `ReaderWasm` JS wrapper passes the same 50 generated prefix/cache/decode fixtures on SIMD and scalar (max log-prob error 2.27e-4; probability error 7.82e-5). This prototype is not yet connected to the website worker or UI; the public site remains the v8 model.

- 2026-10-26 (continued): implemented release integrity/update plumbing in the website while keeping the active bundle pinned to v8: generated human release ID and separate content hash, page-load no-cache manifest comparison, reload prompt on app/model mismatch, profile-scoped update notice/action, SHA-256 checks for cached and downloaded parts, and old-cache cleanup only after successful initialization plus full Cache Storage persistence. `bun run check` passed (134 tests, lint, static build); Chrome local preview showed the returning-user notice and completed the update flow. This does not complete the v10 integration: the deployed model remains v8 (`af70872adbce`), because the v10 reader WASM is still not connected to the website's grammar/beam/kinlogic answer path. No Cloudflare deploy, commit, or push was made. Continue with v10 end-to-end pipeline parity and device budgets before switching the release identity or publishing.
- 2026-10-26 (Chrome verification): on a clean local Chrome origin, simulated a returning v7 profile plus an old Cache Storage entry, updated to v8, and verified ready/offline, `localStorage` release ID `v8`, only the new `kinship-model-af70872adbce` cache remaining, and removal of the old entry. The loaded model solved the example (“Nicholas is Ashley’s son”). On a second clean origin, served a same-size corrupted `qa.0.bin`; Chrome rejected its SHA-256, left the installed marker at `v7`, retained the prior cache, and did not retain the partial new-model cache. Restored `qa.0.bin` and confirmed its SHA-256 is `9d2ca3c07481ad4cca4124e0e0f0966e2ed85acaa9e12169ce4e7f883b15ff89`. A tampered published manifest (`releaseId: v9-test`) produced the reload warning and blocked model startup because the page expected v8; the manifest was restored to v8 and matched the public source file. The earlier `localhost:8788` “Failed to fetch” message was stale browser/service-worker state; clean origins fetched the no-cache manifest. Notice styling was checked in both dark and light themes; the CSS stacks its content below 560px, but a mobile viewport was not separately exercised. Full `bun run check` passed (134 tests, lint, static build). Active model remains v8 pending full v10 answer-pipeline parity; no deploy/commit/push.
- 2026-10-26 (Cloudflare update follow-up): confirmed `https://kinthread.pages.dev/model-release.json` is HTTP 404 and production HTML still identifies v8. Pages serves deployment snapshots; there is no model database row. Local Wrangler preview from the updated build served the generated manifest and `_headers` sets it no-store. Replaced the reload CTA with “Download latest model,” reused the full-screen download animation, reset its progress for each update, and made release manifests carry the next model descriptor and worker path so a stale app tab can download the published version. `scripts/postbuild.mjs` now fails if the manifest is absent from `out/`. Chrome simulated an older profile, displayed the notice, downloaded and verified all 127.2 MB, initialized v10-r8p, and reached offline-ready. Its Ashley/Nicholas sample answer was wrong (“no family link”), so full parity failed: do not deploy or push the v10 working tree until fixed. No production deploy, commit, or push.
- 2026-10-26 (unseen answer spot-check): on a newly authored three-link question (Leena is Arvind's daughter; Meera is Arvind's sister; Kabir is Meera's son; ask Kabir vs Leena), direct v10-r8p PyTorch + Python `kinlogic` answered “paternal cousin.” To match the website input exactly, applied its rewrite (`Arvind's daughter Leena was there. Arvind's sister is Meera. Meera's son is Kabir.`) and reran with beam 16, split search, exact-clause handling, verifier, coverage, and name priors. Python still read the right facts `@0 daughter @1 ; @0 sister @2 ; @2 son @3 ; ask @1 @3` and returned “paternal cousin” (status `assumed`, confidence 0.699). Chrome on local Wrangler preview `127.0.0.1:8789` returned “no family link” for the same question. No exact people-masked token match was found in 597,035 rows across 10 relevant local files; the base `dataset_v7` pool was on Drive and is absent locally, so this is not a certified train-excluded holdout. One spot-check is not an accuracy estimate; it confirms browser inference parity is still broken, likely in WASM decoding or its bridge into `kinlogic`. Production remains v8; do not publish v10.
- 2026-10-26 (latest v10 Chrome/performance check): local Chrome runtime `24c6ea23ca35` returned the correct Ashley/Nicholas “son” relation, but only tentatively at 0.41 and in 107,752 ms. The release updater can download, verify, initialize, and replace an old cache locally; this behavior is independent of answer parity. v10 is not ready to ship because it is extremely slow and uncertain, and its held-out score is below 85%. Corrected the v10 Model details panel so it no longer borrows v8 calibration/beam figures, reports the actual WASM engine and beam, and counts decoder calls/steps/forward rows; added timing telemetry and corrected tentative-answer wording. Current built preview footer is runtime `9d01deab`; `bun run check` passed lint, 139 tests, static export, with one browser end-to-end parity test skipped. The answer was not rerun after the diagnostics landed. Keep production on v8; no deploy, commit, or push.
- 2026-10-26 (continued, v10 Chrome diagnostic): runtime `87cdf9f46b15` / model `c4a1d87737c6` passed two warm-tab Chrome spot checks: Ashley/Nicholas returned the expected mother/son relation (`unique`, 0.69, 15,259 ms); the previously failing Leena/Arvind/Meera/Kabir case returned paternal cousin (`assumed`, 0.95, 15,286 ms). A clean Chrome tab also returned paternal cousin (`assumed`, 0.95) and displayed the corrected explanation that the solver did not establish a unique answer and the score is uncalibrated. The first clean-tab answer took roughly a minute by wall clock; its exact timing panel was not captured. Both cases are tentative spot checks, not aggregate parity or accuracy; warm latency remains ~15.3 s, with ~13.0 s forward compute. Full `bun run check` passed lint, 139 tests, one intentionally skipped full browser parity test, and static export (160 files, 143.4 MB). Visible DevTools messages were extension-injected font CSP blocks and an unused CSS-preload warning; no site-owned JS error was visible. Wrangler lists previous production deployment `af2acf01-2aed-481a-b7ec-5f14f2aa7c26` from source `63bb7fe` (15 hours before this check); public Pages returned HTTP 403 to this environment, so live assets were not verified. No deploy, commit, or push.

- 2026-10-27 (threaded v10 follow-up): canonical/model repos now include precomputed RoPE tables and SIMD/scalar pthread reader builds; the site uses threaded WASM only for isolated devices reporting at least 8 GB, with low/unknown-memory fallback kept single-threaded. The threaded module needs 384 MiB because beam KV slots branch; 192/256 MiB builds exhausted memory on a deep story. `bun run check` passed: lint, 139 pass, one intentional skip, static export (164 files / 143.6 MB); Node/Pyodide decoder integration passed 3/3, including a full three-link answer. Reused native Chrome on runtime `f608eed15e9b`; it returned the correct paternal-cousin answer (`assumed`, score 0.95 uncalibrated) in 9,632 ms with SIMD/two WASM threads (5 calls, 5,683 forward rows, 387 decode steps; tab memory showed 581 MB). This is one smoke check, not broad parity or a controlled benchmark. Console showed extension font CSP blocks and CSS preload warning, no visible site JS error. Browser inventory is disabled in Work settings. Production stays v8; locked test is 68.8% fair / 72.2% verified (<85%). No deployment, commit, or push; 300-question parity, calibration, rollback, and mobile/low-memory budgets remain release gates.

- 2026-10-27 (v10-r8p production deployment): at the owner's explicit request, pushed website commit 6f32924 and ran bun run deploy for Cloudflare Pages project kinthread under the owner's account. Production manifest now identifies v10-r8p, checkpoint SHA-256 38c289d351d6517b5cde1bc9fb64ea97bd33eee193639d6351edda52fdfd7a52, content c4a1d87737c6, and runtime f608eed15e9b. Live production matched all 66 model assets (127,187,553 bytes) and all 20 runtime files (14,012,183 bytes) by size and SHA-256. This deployment was authorized before all quality gates were complete: locked-test accuracy is 68.8% fair / 72.2% verified (<85%), and broad browser/Python parity, calibration, and low-power/mobile budgets remain open. One Chrome answer smoke check is not an accuracy estimate.
- 2026-10-28 (v10 decoder parity, cloud session): `runtime/v10-decoder.js` now matches `reader.generate`: each decoded
  token attends to its own key/value slot (it did not; first-step log-prob error 0.41, now 0), `<eos>` is allowed right
  after a complete statement (it needed a forced `;` first), the beam stops at k finished readings, and an optional
  `reserve` budget filter (off) mirrors `kinlogic.facts.budget_filter`. Tests in `tests/v10-decoder.test.mjs` (6 pass,
  including the real-model Pyodide answer). Runtime hash a171d14ed9a4 (model c4a1d87737c6 unchanged). On 89 hard
  local rows: same answers within noise (54/52/53 top-1), mean decode 4.5 s -> 2.8 s. Open: the site still sends the
  v8 `forModel` rewording (`Workbench.jsx:89,117`) and drops the exam question and options, so the browser never runs
  the option mapping the measured dev pipeline uses; compare raw vs reworded input on a fixed question set before
  changing it. Not deployed.
- 2026-10-28 (v10 input path, cloud session): compared the v10 inputs on a fixed set: the 6 page examples plus 60
  generated questions with known answers (`tools/input-compare/questions.json`, from the model repo's
  `python -m eval.web_input_set`; 18 with options; no private dev/test questions), answered through the synced
  Node/Pyodide pipeline (`node tools/input-compare/compare.mjs`). Beam 16 (high tier): old input (`forModel`, question
  and options removed, picker question added) 57/66 = 86.4%; the same without rewording 57/66; raw pasted text 63/66 =
  95.5%, exam score with option letters 64/66 = 97.0% (keyed option 18/18); raw fixed 7, broke 1 (McNemar exact
  p = 0.07). Shipped rule vs old input: beam 8 63/66 = 95.5% vs 58/66 = 87.9% (6 fixed, 1 broken); beam 4 60/66 =
  90.9% vs 52/66 = 78.8% (10 fixed, 2 broken). Latency on the 4-core cloud box, 4 WASM threads, mean / p90 / max:
  beam 16 old 3.7 / 5.7 / 88.7 s, shipped 1.4 / 3.8 / 5.5 s; beam 8 2.8 / 3.4 / 80.8 s vs 0.8 / 2.4 / 3.4 s; beam 4
  1.7 / 2.3 / 44.4 s vs 0.6 / 1.5 / 2.2 s. Why: `forModel` hides "X is the son of Y" from kinlogic's exact rule readers
  (22 of 66 answered with no reader call vs 11); `splitQuestion` deletes facts sharing the question's sentence ("If
  Umesh's child is Utkarsh, then how is Utkarsh related to Umesh?" left an empty story); options let `kinlogic.exam`
  pick the keyed option. Consistent loss: one nested detour chain (obfuscated-11). Changed: v10 reads the text as
  written (`exam.js readerInput`, a `reader` field through client.js/worker.js, `askV10(..., { asked })`); a pasted
  question about other people is dropped with its options; if the reading's question is not the picked pair the
  pipeline adds the picker's question and reads again; a chosen "cannot be determined" option shows as no established
  relation (it read "B is A's cannot be determined"). v8 still reads `forModel`. Tests: `readerInput` unit tests;
  real-model tests for the option pick, the picker fallback and "cannot be determined". `bun run check`: lint, 147
  tests (146 pass, 1 intentional skip), static build; runtime e881499ef517, model c4a1d87737c6 unchanged (measured on
  runtimes 5f7b1ad0feed / d5154c2efcc9; the last change touches no measured row). Headless Chromium (Playwright; the
  owner's Chrome is not reachable from the cloud box) on the built site via the harness server answered three pasted
  questions right (son 1.2 s, father 6 ms, brother 1.1 s; beam 8, 2 threads), no console errors. Open: a check in the
  owner's Chrome; the spoken-clue "not supported" tip (described-person questions 12/12 raw; owner's call); production
  still runs without `--adaptive`/`--para`; generated set only (dev 73.9% / locked 68.8% unchanged). Built on branch
  `claude/nice-hamilton-3ttcwr` (decoder parity). Not deployed.
- 2026-10-29 (one branch): `main` now holds the v10 decoder parity fix and the pasted text read as written (merged from
  the two claude/* branches; runtime e881499ef517, model unchanged; `bun run check`: 146 pass, 1 intentional skip,
  static export). Not deployed. Only `main` remains (the merged branches are deleted on GitHub).
