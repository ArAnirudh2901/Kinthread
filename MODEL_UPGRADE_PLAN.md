# Plan: move Kinthread to the new kinship reader

State now: the site (Next.js static export, Cloudflare Pages `kinthread.pages.dev`) runs the old v8 QA GPT (13M) in
WASM (`vendor/kinship/`: `engine.c` -> 6 WASM builds, `kinship.js` worker, `model/` fp32 byte-shuffled gzip parts,
SHA-256 manifest, resumable downloads, cone loader, share links, contradiction checks, COOP/COEP in `_headers`).
New system (model repo `Kinthread-llm-model`, branch `v9-reader`; story in `2_Training_Tiny_LLM/JOURNEY.md`):
`prepare` -> exact readers (codes/rules/speech) -> v10 reader (39.5M, 16x384, RoPE, RMSNorm, SwiGLU, tied embeddings,
copy head, optional prefix-LM mask, sub-word vocab 28,836) with grammar-constrained beam -> exact engine (`kinlogic/`,
pure Python) -> exam layer (vote, conventions, options) + answer-time boosters chosen by `FINAL.json`.
Rule: fp32, no quantization, no distillation; runs on the user's device (privacy, free hosting).

## Recommended route: everything in the browser
Pyodide runs the pure-Python `kinlogic` unchanged (no logic port, no drift); the reader's forward pass runs in our own
WASM (extend `engine.c`); Python drives the beam and calls WASM per step.

### Phase 1. Export (Python, model repo)
1. `export_web.py --arch v10 --ckpt runs/<final>/best.pt`: weights fp32, byte-shuffled gzip, parts < 25 MiB
   (Pages per-file limit), `model_manifest.json` (sha256, shapes, config incl. `prefix_lm`, vocab, merges).
2. Also export: `verifier.json` (if FINAL picked it), name table `name_table.tsv.gz` (527 KB), name CNN weights as
   JSON/npy (192k params; reimplement its forward in numpy, Pyodide has numpy, not torch).
3. `verify_model.py` checks every part against the manifest (exit 1 on mismatch).

### Phase 2. Reader forward in WASM (`engine.c`)
1. Add v10 blocks to the existing C GPT: RMSNorm, RoPE (block 448), SwiGLU (hidden 1024), tied output, copy (pointer)
   head, prefix-LM mask (question bidirectional, facts causal) when the config says so.
2. KV cache + shared slot pool (as `fast_qa.py` did for v8); batch of k beams.
3. API to JS: `encode(question ids)` -> cache handle; `step(handle, beam tokens)` -> logits (+ copy scores).
4. Golden test: logits within 1e-4 of PyTorch on 50 prompts (`web/test/test_node.mjs`).

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

## Fallback route: hosted API
FastAPI container running the Python pipeline (CPU fine: 39.5M fp32), the Pages site calls it. Hosts: Hugging Face
Space (free CPU, needs owner's account/token) or Cloudflare Containers (paid). Weights from the model repo; R2 needs
billing enabled. Simpler and faster to ship, but needs a server and sends questions off-device.

## Order and effort
Phase 1 (0.5 day) -> Phase 2 (2-3 days, biggest risk) -> Phase 3 (1-2 days) -> Phase 4 (1 day) -> Phase 5 (1 day).
Start after `FINAL.json` names the final checkpoint and booster setting.
