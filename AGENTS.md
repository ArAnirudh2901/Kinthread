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

- Never deploy from an agent session, with wrangler or any host: the owner deploys from their own account.
  Local `bun run preview` is fine; give the owner the deploy commands instead (README).
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
- Test in the owner's real Google Chrome through the Claude-in-Chrome extension, in ONE reused tab. Never `open -a`
  a URL per test (each opens a new tab). Safari: one tab, closed afterwards. A hidden tab pauses animation frames,
  so harness runs stall unless the tab is in front.
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
| `node tools/harness/server.mjs` | serves `out/` on :8791 with COOP/COEP and no X-Frame-Options, for the browser harness |

## Map of the code

| Area | Files |
| --- | --- |
| Pages | `src/app/` (home, how-it-works, limits, build-log, 404); `layout.js` has metadata and the pre-paint theme script |
| Workbench (steps 1–2) | `src/components/workbench/`: StoryEditor, Examples, PeoplePicker (question with two blanks), TraceBar (Solve button), Workbench (state wiring), `state.js` reducer |
| Map (step 3) | `src/components/map/`: MapPanel, StoryGraph (live force map and worked solution), StepCaption (narration and controls), Solution (folded step list), ResultView (Headline above the map plus result views), ModelLoading, ModelDetails |
| Logic | `src/lib/`: `exam.js` (exam-question input), `relations.js` (kinship composition rules), `worked.js` (step sentences), `solution-layout.js` (generation-tree layout), `graph/engine.js` (force layout), `export-image.js` (PNG), `story.js`, `examples.js`, `kinds.js` |
| Model client | `src/lib/model/client.js` (worker, `modelOnDevice`), `runtime/worker.js` (cache, checksums, inference) |
| 3D | `src/lib/gl/constellation.js` (raw WebGL, lazy) |

## Product decisions (don't undo without asking the owner)

- Dark theme by default, light optional (View Transitions circle reveal). "Red thread" palette tokens (natural dyes: indigo ground/question, weld gold facts, madder red answer and accent, undyed wool text; tokens are role-named: `--answer`, `--answer-fill`, `--on-answer`, `--fact`, `--question`) in `globals.css`.
- Three numbered steps: Write a family story / Pick two people / See how they're related.
- The picker is the question: "How is [ ] related to [ ]?". Blanks fill in reading order (B, the person described,
  first; then A, the reference). Choosing both people, or swapping, solves at once. The button says "Solve".
- No A/B role letters anywhere in the UI (they clashed with exam questions that name people A, B, C).
- Colours: indigo = the question (dashed arrow with "?"), gold = facts (numbered, quoted from the story), red = the
  answer. Pedigree shapes: square male, circle female, diamond not stated. Rows are generations.
- Above the map: the question, which becomes the answer. Under the map: step caption and controls, then legend and
  Download. The full step list is folded. The last caption shows the working ("Victor's father's wife's daughter is
  Victor's sister").
- Jargon (engine, agreement, timings, tokens) only inside "Model details".
- First visit: a window (`ModelGate`, native `<dialog>`) asks before the one-time model download, shows progress and
  closes itself when ready; returning visitors (`modelOnDevice()`) start silently.
- Exam input (`exam.js`): the pasted question is detected, filled in and removed from what the model reads; answer
  options are dropped; single letters count as names; "X is the R of Y" is reworded to "Y's R X was there" for the
  model only (fixes multi-hop chains). The user's text is never changed. Spoken-clue puzzles get a "not supported" tip.
- PNG download of the map: computed styles and fonts inlined; `data-*` attributes stripped (`data-key` holds a NUL).
- GSAP 3.15 for motion (Motion was removed). WebAssembly, not WebGPU: WebGPU measured 3–9x slower per beam step.

## Cross-browser constraints

- No regex lookbehind (Safari before 16.4 fails to parse the whole bundle). No `color-mix()`. `100vh` fallback
  before `dvh`. Avoid `Object.hasOwn`.
- Per-page CSP: `connect-src 'self'`, `img-src 'self' data:` (blob: fetch is blocked; only test code cares).
- Threads need COOP/COEP (`_headers`). Supported floor: Chrome/Edge 80+, Firefox 114+, Safari 15+.

## Testing

- `bun run check` must pass (114 tests on 2026-10-20). The solution-layout test covers 735 chain shapes at phone
  and desktop widths; the model test runs the real runtime on every example and on exam-style questions.
- Browser harness: start `node tools/harness/server.mjs`, then open `http://127.0.0.1:8791/__solve.html` (every example at 1200 and 380 px,
  overlaps, controls, light theme) or `__export.html` (exam example plus PNG download in dark and light, 375 px) in
  the single extension tab. Results append to `tools/harness/result.jsonl`. Expected controls sequence:
  `[3, 0, 2, 3, 0, 4, 1, 0, 4, 3]`. "typed long chain" answer-tag opacity 0 is sampling timing (the tentative
  answer fades in just after the last step).
- Responsive: no page overflow from 320 to 1440 px on every page; the solved map fits without scrolling from 360 px.

## Known limits and open items

- The model is unsure on long "X is the R of Y" chains (shown as a best guess). Coded relations ("A + B means…")
  and spoken-clue puzzles are not supported.
- At 320 px the solved map scrolls sideways inside its box.
- Ask-before-download has not been checked on a real phone.
- The build-log page has two marked placeholders for the owner's own words.
- Deploy waits for the owner's own Cloudflare account; set `SITE_URL` (default `https://kinthread.pages.dev`).

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
