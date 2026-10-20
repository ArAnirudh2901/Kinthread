@AGENTS.md

## Claude-specific

- Persistent memory for this project lives in
  `~/.claude/projects/-Users-anirudharavalli-Generative-AI-LLM-from-Scratch/memory/` (start at `MEMORY.md`;
  `kinship-qa-website.md` covers this site). Update memory and AGENTS.md together at every milestone.
- Skills the owner asked for here: gsap-frameworks and gsap-performance for motion; gpt-taste only where it suits a
  tool for students; caveman sets the chat style only (files stay in plain English).
- Claude in Chrome: call tabs_context_mcp once, then reuse that tab. Batch with browser_batch; each wait is at most
  10 s, and a batch should stay under about 40 s.
