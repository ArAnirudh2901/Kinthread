# Plan: move Kinthread to the new kinship reader

State now (2026-10-26): the site (Next.js static export, Cloudflare Pages `kinthread.pages.dev`) still runs the old v8 QA GPT (13M) in
WASM (`vendor/kinship/`: `engine.c` -> 6 WASM builds, `kinship.js` worker, `model/` fp32 byte-shuffled gzip parts,
SHA-256 manifest, resumable downloads, cone loader, share links, contradiction checks, COOP/COEP in `_headers`).
Selected system (model repo `Kinthread-llm-model`, branch `v9-reader`; story in `2_Training_Tiny_LLM/JOURNEY.md`):
`prepare` -> exact readers (codes/rules/speech) -> v10 reader (39.5M, 16x384, RoPE, RMSNorm, SwiGLU, tied embeddings,
copy head, optional prefix-LM mask, sub-word vocab 28,836) with grammar-constrained beam -> exact engine (`kinlogic/`,
pure Python) -> exam layer (vote, conventions, options) + answer-time boosters chosen by `FINAL.json`.
Rule: fp32, no quantization, no distillation; runs on the user's device (privacy, free hosting).

Final selection is `runs/v10-r8p-final/best.pt` from `/Users/anirudharavalli/Generative_AI/Kinthread-llm-model`, step
6,000, SHA-256 `38c289d351d6517b5cde1bc9fb64ea97bd33eee193639d6351edda52fdfd7a52`. The full-dev pick is `all`
(`--adaptive 1.0 --hybrid --verifier verifier.json --cover --split_search --para 2 --k 16`); it scored 73.9% fair /
77.2% verified on dev and 68.8% fair / 72.2% verified on the locked test (scored once). Do not change the pick or
re-score the locked test to tune it.

Phase 1: `2_Training_Tiny_LLM/export_reader_web.py` exports this reader's 39.50M parameters as exact fp32, with a
126.1 MB byte-shuffled gzip stream and a SHA-256 manifest. It exported to `/tmp/kinthread-v10-final` with
`FINAL.json`, `verifier.json`, and the name table. The current website worktree now packages this export and a
Pyodide/WASM answer path; it has not been published. The existing model stays live until the new runtime passes
end-to-end parity and device budgets.

Phase 2: `web/reader_engine.c` reuses the existing SIMD GEMM kernels and adds v10 RMSNorm, QK RMSNorm,
RoPE, SwiGLU, tied output, KV slot caching and the pointer-copy head. `web/reader.js` wraps the SIMD/scalar builds.
The new build targets leave the v8 engine ABI and binaries intact. Golden check against PyTorch (8-token prefix plus
one cached decode) covers prefix hidden states, decode hidden state, tied logits, copy keys and mixed probabilities;
max absolute difference was `1.15e-5` in both SIMD and scalar builds. A 50-prompt generated fixture and the
`ReaderWasm` JavaScript wrapper also pass on both builds; see Phase 2 below for measured maximums.

## Performance and low-power devices

- Keep the exact fp32 reader. Adapt concurrency and search effort to device capability; never silently change weights.
- Existing site runtime now has low / balanced / high tiers. Low tier uses one WASM thread and one model part download
  at a time; balanced caps at two workers/downloads; high retains four workers and three downloads. Low tier is
  detected from <=2 hardware threads, <=2 GiB reported device memory, or a data-saver / 2G connection hint.
- Decorative WebGL already selects its lite mode on the same low-tier signals, limits pixel ratio to 1, caps at 30 fps,
  and sleeps when the hero is idle.
- v10 target: run inference only in a worker; reserve `k=16` and paraphrase voting for capable devices or an explicit
  deep-check action. Constrained devices should get exact readers + bounded base search first, with visible controls
  for any quality/latency trade-off. Preserve offline use and progressive caching.
- Measure on real Chrome at desktop and phone widths, including constrained CPU/network profiles. Do not claim the
  v10 site deployment or mobile answer-time targets until the full pipeline and browser parity are verified.
- Full fp32 inference is compute-heavy: low-power mode must bound test-time compute and expose a deep-check action
  rather than running 16 beams and two paraphrases on every phone question. Benchmark power/latency before selecting
  its default beam; correctness/quality costs must be explicit.
- The device-profile resource limits were published with the current v8 site on 2026-10-26 at
  `https://af2acf01.kinthread.pages.dev` (Cloudflare Pages production branch `main`). This is not the v10 release.
- `bun run check` passed immediately before deploy (lint, 130 tests, static export). The first local Chrome harness
  attempt showed a blank page and produced no result log; later direct Chrome checks covered release mismatch,
  returning-user update, successful replacement, checksum failure, and inference. See the section below.

## Route: download once, run on the user's device
Cloudflare Pages only serves the files (weights in resumable <=2 MiB parts, cached in the browser); no server runs the model.
Pyodide runs the pure-Python `kinlogic` unchanged (no logic port, no drift); the reader's forward pass runs in our own
WASM (`reader_engine.c`); Python drives the beam and calls WASM per step.

### Phase 1. Export (Python, model repo)
1. `export_reader_web.py --ckpt runs/v10-r8p-final/best.pt --out web/v10`: weights fp32, byte-shuffled gzip; split into
   <=2 MiB parts by the site sync script. SHA-256 manifest includes shapes and config (`prefix_lm`, vocab, merges).
2. Also export: `verifier.json` (if FINAL picked it), name table `name_table.tsv.gz` (527 KB), name CNN weights as
   JSON/npy (192k params; reimplement its forward in numpy, Pyodide has numpy, not torch).
3. `verify_model.py` checks every part against the manifest (exit 1 on mismatch).

### Phase 2. Reader forward in WASM (`reader_engine.c`)
1. Prototype is implemented and numerically checked in isolated SIMD/scalar builds. The 50-prompt generated parity
   fixture covers statements, nested, coded, sufficiency, puzzle, speech, claims, and story questions; prefixes range
   from 13 to 101 tokens. Both builds pass: max errors are `2.86e-5` prefix state, `1.38e-5` cached decode, `1.53e-5`
   tied logits, `2.38e-5` copy keys, and `7.82e-5` mixture probabilities. Log-probability tail max is `2.27e-4`;
   its test ceiling is `1e-3` because fp32 tail log scores amplify rounding. The short-prompt smoke test also passes.
   The same 50 cases pass through the JS wrapper's prefill/cache-growth/decode path (max log-prob difference
   `2.27e-4`, max probability difference `7.82e-5`). This still does not validate full generation; binaries remain unsynced.
   Reproduce from the LLM-From-Scratch root with its `.venv` Python:
   `python 2_Training_Tiny_LLM/web/test/make_reader_parity.py --ckpt /Users/anirudharavalli/Generative_AI/Kinthread-llm-model/runs/v10-r8p-final/best.pt --out /tmp/kinthread-reader-parity-50 --count 50`, then run `test_reader_parity_50.mjs` once per engine and `test_reader_wrapper_50.mjs` for wrapper parity (all take `--export=/tmp/kinthread-v10-final --golden=/tmp/kinthread-reader-parity-50`).
2. Test beam rows that share parent slots, actual long prefixes, and profile KV memory on low-memory devices.
3. Confirm prefill and decode latency on SIMD/scalar WASM and autotune tiles on target CPUs; add thread support only
   after confirming its memory and power costs.

### Phase 3. Pipeline in Pyodide (worker)
The first browser implementation now loads `kinlogic.zip` with Pyodide, calls the exported v10 reader through a JS
beam decoder, and maps answers back to the site's worker protocol. Chrome verified the download and initialization,
but an example where Lillian is Ashley's daughter and Nicholas's sister returned “no family link.” This proves the
answer pipeline is not at parity; debug extraction/beam/solver integration before publishing. A second, newly authored
three-link question was correct with direct v10-r8p PyTorch + Python `kinlogic` (“paternal cousin”). To match the website
input exactly, the story was rewritten as `Arvind's daughter Leena was there. Arvind's sister is Meera. Meera's son is
Kabir.` and rerun with the browser's beam-16, split-search, exact-clause, verifier, coverage, and name-prior settings.
Python still read the correct facts and answered “paternal cousin” (status `assumed`, confidence 0.699); Chrome on the
local Wrangler preview returned “no family link” for that same prompt. This single spot-check is not an accuracy metric;
it confirms the error is in WASM decoding or its bridge into the browser's `kinlogic` pipeline, not the checkpoint's
direct answer path. Keep exact readers before the model and gate expensive boosters on device tier only after parity and
latency checks. The model-format input had no exact people-masked match in 597,035 rows across 10 relevant local
training/evaluation files. The original v10 base pool (`dataset_v7`) is absent from this local clone (it was on Drive),
so this remains a fresh spot-check rather than a formally certified train-excluded holdout.

### Phase 4. UI
1. Input: free text + optional options (a)-(e); show the read facts, the family the engine built, the worked
   explanation (`kinlogic/explain.py`), confidence, "not related", "cannot be determined" reasons.
2. Reuse loader (exact progress over parts), share links, contradiction warnings; add "model version" footer
   (`FINAL.json` checkpoint + date).

### Phase 5. Verify, then deploy
1. Parity: 300 real dev questions + construction suite, browser vs Python, same answers (allow 0 diffs on exact
   readers, < 1% on beam ties).
2. Budgets: first load < 200 MB transfer with cache; answer < 3 s desktop, < 8 s mid phone; memory < 1 GB.
3. Sync `vendor/kinship/` from the model repo export, update SHA manifest, `npm run build`, check `_headers`
   (COOP/COEP for SharedArrayBuffer), deploy with wrangler to classic Pages `kinthread.pages.dev` (only after
   `wrangler whoami` shows the owner's account).

## Order and effort
Phase 1 (0.5 day) -> Phase 2 (2-3 days, biggest risk) -> Phase 3 (1-2 days) -> Phase 4 (1 day) -> Phase 5 (1 day).
Start after `FINAL.json` names the final checkpoint and booster setting.

## Release/update work completed 2026-10-26

The website now has the release-manifest/update mechanics described above, but they are currently pinned to the shipped
v8 checkpoint while the v10 end-to-end solver is unfinished. `scripts/sync-runtime.mjs` checks the release ID and
checkpoint SHA against the source manifest (or the vendored manifest), hashes every deployed model part, emits the
app-embedded release metadata and `public/model-release.json`, and checks already-generated asset folders before
skipping them. The content hash remains the asset path and Cache Storage key; the human release ID is separate. The
page checks the published manifest with `cache: no-store` before model loads, gives a returning browser a model-update
action, rejects same-size corrupt cache entries, and only records the new release / removes prior caches after model
initialization and complete persistent caching succeed. Chrome verified the returning-user notice, successful update
to ready/offline, v8 release marker, removal of the seeded old cache, and an inference answer. A same-size corrupt
model part was rejected by SHA-256; Chrome kept the old release marker and cache, and discarded the partial new cache.
The altered local preview file was restored and its SHA-256 matched the release manifest. Chrome was also served a
temporarily altered manifest (`releaseId: v9-test`): the page showed the reload warning and blocked model startup
against the v8 release expected by the app. The manifest was restored and matched `public/model-release.json`.
Final `bun run check` passed (134 tests, lint, static build).

At the original release-update milestone, build identity was deliberately still `v8` (`runs/clutrr-qa-v8/best.pt`,
SHA-256 `1e7c9eeb4325d328aad6b97ad9c7532fda77e713eeb7a303d34600cfe46ecc3e`, asset hash `af70872adbce`). The current
working tree now generates a `v10-r8p` candidate, while production remains v8. Do not publish it until the worker can
answer full questions through v10 reader decode, grammar-constrained beam, exact `kinlogic` pipeline, and configured
exam boosters; numeric WASM parity alone is insufficient. No production deployment was made.

## Cloudflare Pages and release updates (2026-10-26, follow-up)

Cloudflare Pages serves the static `out/` snapshot uploaded by Wrangler. There is no model database row to replace.
Production changes when Pages switches the branch URL to a new deployment snapshot; model files and the release
manifest must both be present in that snapshot. The current production URL returned HTTP 404 for
`/model-release.json`, confirming its active deployment predates this manifest. The generated local `out/` now
contains the manifest, `_headers` gives it `no-cache, no-store, must-revalidate`, and `runtime/sw.js` bypasses its
shell cache for that path. `scripts/postbuild.mjs` now fails if the manifest is missing from the Pages export.

The working tree generalizes release metadata to include the published model descriptor and hashed worker path. An
already-open app can read a later release and start that worker/model through the existing full-screen download
gate. Its action says “Download latest model”; the progress follower resets for a new release, and old model caches
are still deleted only after verified initialization and complete persistence. Chrome on Wrangler preview verified
the returning-profile notice, in-place download animation, successful 127.2 MB v10-r8p initialization, and
offline-ready status. `bun run check` passes lint, 134 tests, and static build; the v10 end-to-end answer test is
explicitly skipped pending browser parity. However, the same Chrome run exposed the incorrect Ashley/Nicholas answer
above. Do not deploy or push this v10 worktree until that answer path and the planned parity suite pass. No production
deployment, Git commit, or push has been made.

## Latest local v10 diagnostic (2026-10-26)

The replacement mechanism and model behavior are separate gates. Local Chrome completed the update path: it fetched
the versioned `v10-r8p` release, verified all model files, initialized the worker, reached offline-ready, and only then
removed the seeded old cache. This verifies replacement mechanics for the local build; it does not establish answer
parity with v8 or production readiness. Wrangler still lists the previous production deployment
`af2acf01-2aed-481a-b7ec-5f14f2aa7c26` (source `63bb7fe`, created 15 hours before this check); no deployment was made
for this work. Direct requests to the public Pages hostname returned HTTP 403 from this environment, so the live
manifest and file hashes could not be fetched during this turn.

On runtime `87cdf9f46b15` (model content hash `c4a1d87737c6`), Chrome ran two diagnostic questions. Ashley/Lillian/
Nicholas returned the logically equivalent “Ashley is Nicholas's mother” / “Nicholas is Ashley's son,” status `unique`,
confidence 0.69, in 15,259 ms. The three-link story (Arvind's daughter Leena; Arvind's sister Meera; Meera's son Kabir;
ask Kabir vs Leena) returned “paternal cousin,” status `assumed`, confidence 0.95, in 15,286 ms. The latter had
previously returned “no family link” in Chrome, so this spot check now matches the Python answer. Both remain labeled
tentative: confidence is not calibrated for v10, and the second result is not a unique solver result. These two cases
are not an accuracy estimate or a full parity comparison. Telemetry showed about 15.3 seconds total, with about
13.0 seconds in the forward pass; this is well above the desktop latency budget.

The v10 details panel now reports the actual SIMD/scalar engine, beam, reader calls, forward rows/decode steps, and
per-stage timing; it no longer borrows v8 calibration. Tentative copy now distinguishes a low-confidence unique result
from a non-unique solver status. An already-open Chrome tab still displayed the earlier wording from its loaded bundle.
A clean Chrome tab loaded the current bundle, became ready, and returned the expected “paternal cousin” answer for the
three-link regression (`assumed`, score 0.95). It showed the corrected explanation: v10 did not establish a unique
answer, and the score is uncalibrated. The fresh-tab first answer took roughly a minute by wall clock, while previous
warm-tab checks took about 15.3 s; no exact cold-run timing was captured. Treat cold-start latency as a release blocker.
DevTools showed extension-injected font requests blocked by the page CSP and an unused CSS-preload warning; no
site-owned JavaScript error was visible among the displayed messages. `bun run check` passed: lint, 139 passing tests, one
explicitly skipped end-to-end browser parity test, and static export (160 files, 143.4 MB). `git diff --check` passed
before the latest documentation update.

Keep v8 in production. The locked-test result remains 68.8% fair / 72.2% verified, below the 85% target. Next release
gates are a frozen browser-vs-Python question set (including a 300-question suite), calibrated confidence, successful
and failed update/rollback checks, and latency/memory checks on desktop, balanced, and low-power profiles. Do not
deploy until those gates pass.

## Threaded v10 follow-up (2026-10-27)

The canonical WASM reader now precomputes its RoPE sin/cos table and includes SIMD/scalar pthread builds capped at
four workers. The website selects the threaded runtime only on isolated, high-capacity devices reporting at least
8 GB memory; low-power and unknown-memory devices remain single-threaded. The pthread module uses 384 MiB fixed
memory because beam hypotheses allocate distinct KV slots; 192/256 MiB builds ran out of memory on a deep story.
The checkpoint and exact fp32 weights are unchanged.

Runtime `f608eed15e9b` / model content hash `c4a1d87737c6` passes SIMD/scalar wrapper parity on 50 generated prompts
through prefill, cache growth, and cached decode (max log-prob difference `2.27e-4`, probability difference
`7.82e-5`). A Node/Pyodide end-to-end regression now runs the v10 answer path on a three-link story and returns
paternal cousin. In Chrome, that story returned the expected paternal-cousin answer as `assumed`/tentative, score
`0.95` (uncalibrated), in `9,632 ms`; Chrome selected SIMD with two WebAssembly threads. Telemetry counted 5 reader
calls, 5,683 forward rows, and 387 decode steps. One earlier warm single-thread run took about `15.3 s`; this
single-run comparison is encouraging but not a controlled benchmark. Chrome showed about `581 MB` tab memory,
also a single observation rather than a device budget result.

`bun run check` passes lint, 139 tests, one intentional skip (the broad site-example parity test), and static build
(164 files, 143.6 MB). The standalone Node/Pyodide decoder integration test passes 3/3. Chrome console showed
extension-injected font requests blocked by page CSP and a CSS-preload warning; no site-owned JavaScript error was
visible. Browser automation inventory is disabled in Work settings, so this check reused the open native Chrome app.
Production remains v8; locked-test accuracy remains 68.8% fair / 72.2% verified. No deployment, commit, or push was
made. Full 300-question browser/Python parity, update rollback paths, confidence calibration, and mobile/low-memory
latency tests remain open.

## Production publication — 2026-10-27

The owner explicitly authorized publication of v10-r8p before the remaining quality gates were complete. Cloudflare Pages project kinthread now serves the release. The production no-cache manifest reports checkpoint SHA-256 38c289d351d6517b5cde1bc9fb64ea97bd33eee193639d6351edda52fdfd7a52, content hash c4a1d87737c6, and runtime hash f608eed15e9b. Live SHA-256/size checks passed for all 66 model assets (127,187,553 bytes) and 20 runtime files (14,012,183 bytes). The website update flow remains version-aware and verifies asset bytes before accepting an installed release.

The release does not meet the 85% target: locked-test results are 68.8% fair / 72.2% verified. The local Chrome paternal-cousin check (tentative, uncalibrated 0.95, 9,632 ms, SIMD/two threads) is a single smoke test. Broad browser/Python parity, calibration, and mobile/low-memory budgets remain unresolved. This entry supersedes earlier planned “keep v8 in production” instructions; those entries document the pre-publication decision.
