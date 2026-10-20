---
name: Kinthread
description: Blood-relation puzzles, solved step by step, by a from-scratch AI that runs in your browser.
colors:
  board: "#11201a"
  board-surface: "#172a22"
  board-surface-2: "#1e352b"
  chalk: "#edf2ea"
  chalk-muted: "#a9b9ae"
  line: "#2a4035"
  line-strong: "#6b8374"
  yellow-chalk: "#f3d34a"
  on-yellow: "#17241c"
  blue-chalk: "#8fc8f2"
  white-chalk: "#e4ebe2"
  paper: "#f3f5ef"
  paper-surface: "#fbfcf9"
  board-ink: "#14231b"
  ochre: "#7d5f00"
  blue-pen: "#1b6299"
  pencil: "#2e4237"
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
  lede:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.05rem, 0.98rem + 0.35vw, 1.22rem)"
  h1:
    fontFamily: "Fraunces, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2.4rem, 1.5rem + 3.6vw, 4.2rem)"
  h2:
    fontFamily: "Fraunces, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(1.65rem, 1.25rem + 1.6vw, 2.35rem)"
  h3:
    fontSize: "clamp(1.35rem, 1.1rem + 1vw, 1.9rem)"
  h4:
    fontSize: "clamp(1.25rem, 1.05rem + 0.8vw, 1.55rem)"
  figure:
    fontFamily: "Fraunces, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(3.6rem, 2.6rem + 5vw, 6rem)"
  body-lg:
    fontSize: "1.0625rem"
  ui:
    fontSize: "0.9375rem"
  small:
    fontSize: "0.875rem"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
  map-name:
    fontSize: "14px"
  map-tag:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11.5px"
  map-row:
    fontSize: "12px"
rounded:
  map-square: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  gutter: "16px"
  max: "1160px"
components:
  button-primary:
    backgroundColor: "{colors.yellow-chalk}"
    textColor: "{colors.on-yellow}"
    rounded: "{rounded.pill}"
    height: "50px"
  button-secondary:
    textColor: "{colors.chalk}"
    rounded: "{rounded.pill}"
  answer-tag:
    backgroundColor: "{colors.yellow-chalk}"
    textColor: "{colors.on-yellow}"
    rounded: "{rounded.pill}"
---

# Design System: Kinthread

## Overview
"Chalkboard": the board every Class 10 classroom has, and the exam paper the answer is written on. Dark by default:
a green-black board with chalk-white text and three chalks that each carry one meaning on the relationship map. Light
is the paper: board-dark ink, blue-pen facts, and the answer underlined with a yellow highlighter. The map is the
product; everything else stays quiet. Chosen 2026-10-20 to replace "Red thread", whose red-orange and cream read as an
AI assistant's house colours.

## Colors

### Primary
Yellow chalk (`#f3d34a`; light: ochre `#7d5f00` lines over a yellow highlighter band): the answer, the thread, and the
one brand accent. Dark fills are yellow with board-dark text (`#17241c`, 10.9:1); light fills are board-dark with
yellow text.

### Secondary
Blue chalk (`#8fc8f2`; light: blue pen `#1b6299`): facts from the story, numbered steps, people on the path.

### Tertiary
White chalk (`#e4ebe2`, dashed; light: pencil `#2e4237`): the question, the dashed "?" arrow, the starting person's
diamond, focus rings.

### Neutral
Board `#11201a`, surfaces `#172a22` / `#1e352b`, chalk `#edf2ea`, muted chalk `#a9b9ae`; light: paper `#f3f5ef`,
`#fbfcf9`, board ink `#14231b`.

### Named Rules
- One meaning per chalk: never use yellow for warnings or decoration, never blue for links that are not facts.
- No orange, terracotta, cream, violet or indigo anywhere: those read as AI-assistant colours.
- Tokens are role-named in code: `--answer`, `--answer-fill`, `--on-answer`, `--answer-rgb`, `--answer-tint`,
  `--fact`, `--question`. Components never hard-code a colour; the WebGL palettes in `lib/gl/constellation.js`, the
  favicon, Apple icon and share image are the only literal copies and must match these values.
- All text at least 4.5:1 on its ground in both themes; control borders at least 3:1. Yellow, blue and white sit on
  the blue-yellow axis, so the three meanings stay distinct for red-green colour blindness.

## Typography
Fraunces for display (soft optical serif, negative tracking), Geist for UI, reading and labels. Geist Mono only for
data: the model's tokens and the relation tags on the map. Every size is a `--fs-*` token (see frontmatter); the map's
SVG text keeps fixed pixel sizes because `lib/measure.js` lays labels out with them.
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
Primary: yellow-chalk fill with board-dark text (light: board fill, yellow text), pill, scales to 0.96 on press. Secondary: outline pill. Every control has `:active`
feedback; hover styles only apply with a fine pointer.
### Chips
Names found in the story; the chosen ones get a white-chalk ring.
### Cards / Containers
The map sheet: board surface with a faint dotted grid (the loom).

## Do's and Don'ts
- Do keep motion calm: entrances once, then rest. The hero spin decays and the render loop sleeps.
- Do show the working; don't animate keyboard actions.
- Don't add gradients, glows or decorative numbering; don't invent proof.
- No eyebrows or kickers above headings, no tiny uppercase tracked labels, no coloured side bars on callouts: labels
  are sentence case at 13px, callouts are a tone step, status sits after the headline it qualifies.
- Ease-out (`--ease`) for CSS; springs (`lib/motion.js`, ~1% overshoot at most) for shapes that change; no bounce,
  entrances start near full size (scale >= 0.85).
- Shape morphing: a control that changes state stays one shape (size, radius, colour) and its content swaps with a
  short blur; the model window grows out of the control that asked for it and returns into it.
- Don't introduce a fourth meaning colour.
