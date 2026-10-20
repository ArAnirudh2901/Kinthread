# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
- Class 10 and competitive-exam students (CBSE-style "blood relation" reasoning questions) who want to check their
  working step by step. They often paste textbook questions as they are, with letters as names and answer options.
- Parents and teachers who want to see and share the working (the map downloads as an image).
- Curious visitors, often on phones and mobile data, interested in an AI that runs on their own device.

## Product Purpose
Given a short family story or an exam question, show how two people are related, worked out one fact at a time the
way a student writes it on paper, ending in the answer. Success: a student understands why the answer is right (or
sees when the model's steps disagree with its answer).

## Positioning
The models were written and trained from scratch by the owner (a 13M-parameter relation transformer and a 5.1M name
tagger) and run entirely in the browser via WebAssembly: no server, no account, nothing uploaded. The reasoning is
shown, not hidden, and fixed kinship rules re-check it.

## Operating Context
Used beside homework or exam practice, on phones and laptops. First visit downloads the model once (63.9 MB; phones and
data-saver connections are asked first), then it works offline.

## Capabilities and Constraints
- English stories with named people, third person, up to about 280 words; 18 relationships; best on 2–4 step chains.
- Exam input: the question ("How is C related to B?", "What is C to B?", "C is related to B as?") is detected and
  filled in; options are ignored; single letters count as names.
- Not supported yet: spoken-clue puzzles ("Pointing to a photograph, A said…"), coded relations ("A + B means…").
- Says "unknown" when the story gives no family link; marks low-confidence answers as a best guess.
- Exact fp32 weights only (no quantization, no smaller or distilled model). Static site; deploy target Cloudflare Pages.

## Brand Commitments
- Name: Kinthread. Subtitle: "Blood-relation puzzles, solved step by step." Slogan: "Find the thread that connects them."
- Dark theme by default, light optional. Plain, simple language a Class 10 student understands.
- Only the owner (ArAnirudh2901) appears as a contributor.

## Evidence on Hand
- Real model results (CLUTRR): validation 89.8%, with distractors 78.2%, test (longer chains) 44.8%.
- Browser speed: about 26 ms per question on an Apple M2 in Chrome.
- No testimonials, users, press or partners exist: never invent them.

## Product Principles
1. Show the working, not just the answer.
2. Honest over confident: say "unknown" or "best guess" rather than bluff, and flag when the steps disagree.
3. Private by construction: everything stays on the device.
4. Anyone can use it: three plain steps, no jargon on the main screen.
5. Works on the phone a student actually has.

## Accessibility & Inclusion
WCAG AA contrast in both themes; keyboard operable; screen-reader announcements for each step; reduced motion and
increased contrast respected; touch targets sized for thumbs.
