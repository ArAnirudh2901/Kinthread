---
name: Kinthread
description: Blood-relation puzzles, solved step by step, by a from-scratch AI that runs in your browser.
colors:
  indigo-night: "#0f1423"
  indigo-surface: "#161d30"
  indigo-surface-2: "#1e2740"
  wool: "#f1eadb"
  wool-muted: "#b2ac9e"
  line: "#2a3248"
  line-strong: "#6b7590"
  madder: "#ee5a40"
  madder-fill: "#c93a26"
  on-madder: "#fff6ea"
  weld: "#e2b04a"
  indigo-dye: "#8fa2e6"
  linen: "#f4efe4"
  linen-surface: "#fbf8f1"
  indigo-ink: "#1a2033"
  madder-deep: "#b5311e"
  weld-deep: "#865c05"
  indigo-deep: "#3b4da6"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2.5rem, 1.4rem + 4.6vw, 4.8rem)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.55
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.72rem"
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  gutter: "16px"
  max: "1160px"
components:
  button-primary:
    backgroundColor: "{colors.madder-fill}"
    textColor: "{colors.on-madder}"
    rounded: "{rounded.pill}"
    height: "50px"
  button-secondary:
    textColor: "{colors.wool}"
    rounded: "{rounded.pill}"
  answer-tag:
    backgroundColor: "{colors.madder-fill}"
    textColor: "{colors.on-madder}"
    rounded: "{rounded.pill}"
---

# Design System: Kinthread

## Overview
"Red thread": the legend that an invisible red thread ties together people who belong to each other, dyed in the
natural colours of thread. An indigo night ground (undyed linen in light), wool-cream text, and three dyes that each
carry one meaning on the relationship map. Dark by default. The map is the product; everything else stays quiet.

## Colors
### Primary
Madder red (`#ee5a40` lines and text, `#c93a26` fills with `#fff6ea` text): the answer, the red thread, and the one
brand accent (main buttons, the solved relation word).
### Secondary
Weld gold (`#e2b04a`; light `#865c05`): facts from the story, numbered steps, people on the path.
### Tertiary
Indigo dye (`#8fa2e6`; light `#3b4da6`): the question, the dashed "?" arrow, the starting person's diamond, focus rings.
### Neutral
Indigo night `#0f1423`, surfaces `#161d30` / `#1e2740`, wool `#f1eadb`, muted wool `#b2ac9e`; light: linen `#f4efe4`,
`#fbf8f1`, indigo ink `#1a2033`.
### Named Rules
- One meaning per dye: never use red for errors or warnings (warnings use indigo), never gold for decoration.
- Tokens are role-named in code: `--answer`, `--answer-fill`, `--on-answer`, `--fact`, `--question`.
- All text at least 4.5:1 on its ground in both themes.

## Typography
Fraunces for display (soft optical serif, negative tracking), Geist for UI and reading, Geist Mono for small labels
and map tags.
### Hierarchy
Display headline, then a 1.05–1.22rem lede, then 1rem body. Step headings are numbered sentence-case instructions
("Write a family story"), not uppercase labels.

## Layout
Two columns on desktop (story and people left; the map right), one column on phones in reading order: write, pick,
see. The map is a generation tree: parents above, children below. On phones, maps scale to at least 0.8 and then
scroll sideways with a faded edge.

## Elevation & Depth
Flat. Surfaces differ by a step in tone; no shadows at rest, no glows. The hero 3D constellation sits behind content,
faded at its edges.

## Shapes
Pill buttons, chips and tags; 12px cards; pedigree shapes on the map (square male, circle female, diamond not stated).

## Components
### Buttons
Primary: madder fill, wool text, pill, scales to 0.96 on press. Secondary: outline pill. Every control has `:active`
feedback; hover styles only apply with a fine pointer.
### Chips
Names found in the story; the chosen ones get an indigo ring.
### Cards / Containers
The map sheet: indigo surface with a faint dotted grid (the loom).

## Do's and Don'ts
- Do keep motion calm: entrances once, then rest. The hero spin decays and the render loop sleeps.
- Do show the working; don't animate keyboard actions.
- Don't add gradients, glows or decorative numbering; don't invent proof.
- Don't introduce a fourth meaning colour.
