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

Phase 1 started: `2_Training_Tiny_LLM/export_reader_web.py` exports this reader's 39.50M parameters as exact fp32,
with a 126.1 MB byte-shuffled gzip stream and a SHA-256 manifest. It exported to `/tmp/kinthread-v10-final` with
`FINAL.json`, `verifier.json`, and the name table. It is not synced into the website. The existing model stays live
until the new runtime passes end-to-end parity and device budgets.

Phase 2 prototype: `web/reader_engine.c` reuses the existing SIMD GEMM kernels and adds v10 RMSNorm, QK RMSNorm,
RoPE, SwiGLU, tied output, KV slot caching and the pointer-copy head. `web/reader.js` wraps the SIMD/scalar builds.
The new build targets leave the v8 engine ABI and binaries intact. Golden check against PyTorch (8-token prefix plus
one cached decode) covers prefix hidden states, decode hidden state, tied logits, copy keys and mixed probabilities;
max absolute difference was `1.15e-5` in both SIMD and scalar builds. A 50-prompt generated fixture and the
`ReaderWasm` JavaScript wrapper also pass on both builds; see Phase 2 below for measured maximums. Neither exporter
output nor reader WASM is synced into the website build yet.

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
1. Bundle `kinlogic/*.py`, `reader.py` decode parts (grammar, `Vocab.encode`, `generate` loop) and `eval`-free exam
   code into a wheel/zip; load Pyodide (~10 MB, cached) in the existing worker.
2. Replace torch calls in `generate` with a thin `wasm_step` bridge (JS function exposed to Python).
3. Keep exact readers before the model (many questions never touch the model: fast path).
4. Boosters from `FINAL.json`: enable the cheap ones by default (`hybrid`, `cover`, verifier); `para`/large k only on
   desktop or as "deep check" button (3-5x compute).

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

Current build identity is deliberately still `v8` (`runs/clutrr-qa-v8/best.pt`, SHA-256
`1e7c9eeb4325d328aad6b97ad9c7532fda77e713eeb7a303d34600cfe46ecc3e`, asset hash `af70872adbce`). Do not rename it to
`v10-r8p` or deploy the selected checkpoint until the site worker can answer full questions through v10 reader decode,
grammar-constrained beam, exact `kinlogic` pipeline, and the configured exam boosters; the existing v10 WASM checks
cover only forward/cache/decode primitives and are not answer-pipeline parity. No production deployment was made.
