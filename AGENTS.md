<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kinthread: handbook for any agent or model

Keep this file current. Whenever a decision, command, constraint or open item changes, update it here (and the
Claude memory noted in CLAUDE.md), so the next model can continue cold. Add a line to the handoff log at the end.

## What it is

Static Next.js 16 site, "Kinthread: blood-relation puzzles, solved step by step". It runs the owner's from-scratch
kinship QA models (a 13M-parameter relation transformer and a 5.1M name tagger) entirely in the browser:
WebAssembly in a module worker, no server. Users: Class 10 and competitive-exam students solving blood-relation
questions, parents and teachers, curious visitors on phones. Renamed from "Kinship QA" on 2026-10-20 (the folder was
`~/Web_Dev/kinship-qa`; storage keys are `kinthread-*`).

The models come from the LLM repo, `~/Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM` (`web/`: engine.c,
kinship.js, six WASM builds, model files; see that repo's AGENTS.md). `npm run sync` copies them into
`public/r/<hash>/` and `public/m/<hash>/` after SHA-256 checks (generated, not committed; `KINSHIP_SRC` overrides).
Without the LLM repo (a fresh clone) it downloads the files pinned in `model.lock.json` from the GitHub Release
(`.model-cache/`). After a model change: sync rewrites the lock, then `npm run model:release` (owner, gh as
ArAnirudh2901) uploads a new release; commit the lock.

## Owner's hard rules

- Never deploy from an agent session, with wrangler or any host: the owner deploys from their own account.
  Local `npm run preview` is fine; give the owner the deploy commands instead (README).
- Commit only when asked; never push unless asked. Repo: https://github.com/ArAnirudh2901/Kinthread (public,
  Apache-2.0, branch `main`), checked out at `~/Web_Dev/kinthread`. It is hidden from the parent `~/Web_Dev` repo (the owner's other
  projects) through `~/Web_Dev/.git/info/exclude`: never commit Kinthread into `~/Web_Dev`.
- Before any `gh` command or push, run `gh auth status`: only act as the owner's account (ArAnirudh2901). If another
  account is active, authenticate that one command with the owner's token or ask the owner to switch; don't switch
  accounts for them.
- No quantization, no smaller or distilled model: exact fp32 weights. Don't push weights.
- Test in the owner's real Google Chrome through the Claude-in-Chrome extension, in ONE reused tab. Never `open -a`
  a URL per test (each opens a new tab). Safari: one tab, closed afterwards. A hidden tab pauses animation frames,
  so harness runs stall unless the tab is in front.
- Production quality; think as the student using it; suggest improvements and flag risks unasked.
- Code comments brief (constraint or reason only). Docs and UI copy in plain English.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server (runs sync first) |
| `npm run build` | sync, `next build` (static export to `out/`), `scripts/postbuild.mjs` (_headers, per-page CSP, sw.js) |
| `npm run check` | lint + all node tests + build: run before reporting work as done |
| `npm test` | node tests only (`tests/*.test.mjs`, includes the real model) |
| `npm run preview` | `wrangler pages dev out` on :8788 (local only) |
| `node tools/harness/server.mjs` | serves `out/` on :8791 with COOP/COEP and no X-Frame-Options, for the browser harness |

## Map of the code

| Area | Files |
| --- | --- |
| Pages | `src/app/` (home, how-it-works, limits, build-log, 404); `layout.js` has metadata and the pre-paint theme script |
| Workbench (steps 1–2) | `src/components/workbench/`: StoryEditor, Examples, PeoplePicker (question with two blanks), TraceBar (Solve button), Workbench (state wiring), `state.js` reducer |
| Map (step 3) | `src/components/map/`: MapPanel, StoryGraph (live force map and worked solution), StepCaption (narration and controls), Solution (folded step list), ResultView (Headline above the map plus result views), ModelLoading, ModelDetails |
| Logic | `src/lib/`: `exam.js` (exam-question input), `relations.js` (kinship composition rules), `worked.js` (step sentences), `solution-layout.js` (generation-tree layout), `graph/engine.js` (force layout), `export-image.js` (PNG), `story.js`, `examples.js`, `kinds.js` |
| Model client | `src/lib/model/client.js` (worker, `askBeforeDownload`), `runtime/worker.js` (cache, checksums, inference) |
| 3D | `src/lib/gl/constellation.js` (raw WebGL, lazy) |

## Product decisions (don't undo without asking the owner)

- Dark theme by default, light optional (View Transitions circle reveal). Mineral Signal palette tokens in `globals.css`.
- Three numbered steps: Write a family story / Pick two people / See how they're related.
- The picker is the question: "How is [ ] related to [ ]?". Blanks fill in reading order (B, the person described,
  first; then A, the reference). Choosing both people, or swapping, solves at once. The button says "Solve".
- No A/B role letters anywhere in the UI (they clashed with exam questions that name people A, B, C).
- Colours: copper = the question (dashed arrow with "?"), teal = facts (numbered, quoted from the story), lime = the
  answer. Pedigree shapes: square male, circle female, diamond not stated. Rows are generations.
- Above the map: the question, which becomes the answer. Under the map: step caption and controls, then legend and
  Download. The full step list is folded. The last caption shows the working ("Victor's father's wife's daughter is
  Victor's sister").
- Jargon (engine, agreement, timings, tokens) only inside "Model details".
- Phones and data-saver connections ask before the one-time 63.9 MB download; desktops start automatically.
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

- `npm run check` must pass (114 tests on 2026-10-20). The solution-layout test covers 735 chain shapes at phone
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
