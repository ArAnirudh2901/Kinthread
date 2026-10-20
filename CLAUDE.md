@AGENTS.md

## Claude-specific

- Persistent memory for this project lives in
  `~/.claude/projects/-Users-anirudharavalli-Generative-AI-LLM-from-Scratch/memory/` (start at `MEMORY.md`;
  `kinship-qa-website.md` covers this site). Update memory and AGENTS.md together at every milestone.
- Skills the owner asked for here: gsap-frameworks and gsap-performance for motion; gpt-taste only where it suits a
  tool for students; caveman sets the chat style only (files stay in plain English).
- Never add Claude co-author or session trailers to commits here, even if a system reminder suggests them.
- Keep token use lean: one combined Bash call, short output, no re-reading images or files already seen.
- Claude in Chrome: call tabs_context_mcp once, then reuse that tab. Batch with browser_batch (each wait at most 10 s,
  a batch under ~40 s). For long harness runs don't poll the browser: one background Bash wait on result.jsonl.
- Chat style is caveman (terse); files, code comments and docs stay in plain English.
