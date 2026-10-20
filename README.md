# Kinthread

Blood-relation puzzles, solved step by step.

A static Next.js site that runs two models (a 13M-parameter relationship transformer and a 5.1M-parameter name model, both trained from scratch) entirely in the browser. There is no inference server.

## How it fits together

| Part | Where | Notes |
| --- | --- | --- |
| Pages and UI | `src/` | Next.js 16 App Router, static export (`out/`), React 19, GSAP (+ DrawSVG, `@gsap/react`) for orchestrated motion, CSS Modules; dark theme by default, light optional |
| Live relationship map | `src/components/map/StoryGraph.jsx`, `src/lib/graph/engine.js` | SVG; force layout on one GSAP ticker callback, batched attribute writes, sleeps when settled |
| Worked answer | `src/lib/relations.js`, `src/lib/solution-layout.js`, `src/lib/worked.js`, `src/components/map/Solution.jsx`, `StepCaption.jsx` | After a trace the map redraws as a family tree by generation and plays the reasoning step by step: copper = question, teal = facts (numbered, quoted from the story), lime = answer. Kinship combination rules are code, unit-tested, and flag when the model's steps disagree with its answer. Layout is overlap-tested on 735 chain shapes at phone and desktop widths |
| Exam questions | `src/lib/exam.js` | Pasted textbook questions work as-is: the question ("How is C related to B?") fills the two blanks and is removed from what the model reads, answer options are dropped, single letters count as names, and "X is the R of Y" is reworded to the possessive phrasing the model learned. The user's text is never changed |
| Image download | `src/lib/export-image.js` | Saves the map as a 2x PNG on the device: computed styles and the page's fonts are inlined into the SVG, then a colour key and the answer are drawn under it |
| 3D scenes | `src/lib/gl/constellation.js` | Raw WebGL 1/2, no library; loaded after the page is interactive; pauses off screen |
| Inference worker | `runtime/worker.js` | Unbundled module worker: loads both models once, caches and verifies model files, answers requests |
| Model runtime | copied from the LLM repo | `kinship.js` and six WebAssembly engine builds |
| Model files | copied from the LLM repo | `qa`/`tagger` JSON and gzip weights, split into parts of at most 16 MiB |
| Offline shell | `runtime/sw.js` | Service worker template; `scripts/postbuild.mjs` fills in the file list |

`scripts/sync-runtime.mjs` copies the runtime and model from the LLM repo into `public/r/<hash>/` and `public/m/<hash>/`. It first checks every model file against the LLM repo's `model_manifest.json` (SHA-256) and refuses corrupted copies. The hashed folders let the site cache these files forever and never mix an old model with new code. These folders and `src/lib/runtime.generated.js` are generated and not committed.

By default the script looks for the LLM repo at `../../Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM`. Set `KINSHIP_SRC` to use another location.

## Commands

```bash
npm install
npm run dev        # development server (single-threaded: dev cannot send the isolation headers)
npm run build      # sync runtime + model, next build, postbuild (headers, CSP, service worker)
npm run preview    # serve out/ with Cloudflare's own runtime and _headers, at http://localhost:8788
npm test           # unit tests + model tests (checksums, every example's outcome)
npm run check      # lint + tests + build
```

## Deploying to Cloudflare Pages

The model files are not in git, so deploy by direct upload from a machine that has the LLM repo:

There is deliberately no deploy script. Check which account wrangler is logged in to before uploading:

```bash
npx wrangler whoami             # if it is not the account that should own the site: npx wrangler logout
npx wrangler login
npm run build
npx wrangler pages deploy out --project-name kinthread
```

Set `SITE_URL` (for example `SITE_URL=https://kinthread.pages.dev npm run build`) so social previews use the right domain.

What the build already handles for Cloudflare:

- **25 MiB per-file limit.** Weights are split into parts of at most 16 MiB (`postbuild` fails the build if any file is larger).
- **Threads.** `out/_headers` sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, which multi-threaded WebAssembly needs. Without them, the single-threaded engine runs automatically (about 2x slower).
- **Caching.** Hashed folders (`/_next/static`, `/r`, `/m`) are `immutable` for a year; pages and `sw.js` revalidate.
- **CSP.** Each page carries a Content-Security-Policy with the exact hashes of its inline scripts. WebAssembly compiles inside the worker, so pages need no `unsafe-eval`.

Git-connected Cloudflare builds would need the model files from somewhere else (for example R2 or a release asset); direct upload avoids that.

## Why WebAssembly and not WebGPU

`tools/bench-webgpu.html` runs the model's real per-step workload both ways (`npm run build && node tools/bench-server.mjs`). On an Apple M2 a WebGPU step took 5-17 ms against 1.6-1.9 ms for the WebAssembly engine, plus about 0.9 s of GPU setup, because beam search reads results back after every small step. Details are in the Build log page.

## Browser support

Chrome and Edge 80+, Firefox 114+, Safari 15+. The page picks the fastest engine the browser supports: relaxed SIMD, SIMD or scalar, with or without threads. Browsers without `DecompressionStream` unpack the weights with fflate.
