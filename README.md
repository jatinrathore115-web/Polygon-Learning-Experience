# Polygon Learning Experience

An interactive polygon lesson for young learners — a frozen-scene game screen with a
mammoth guide who introduces each step, watches the learner work, and reacts to their
answers. 47 screens covering open/closed figures, straight vs curved boundaries, sides,
vertices, angles, and polygon naming from triangle to octagon.

Static site — no build step, no dependencies.

## Run it locally

Any static server will do; it must be served over HTTP (not opened as a `file://` URL,
because the runtime fetches its own template).

```bash
npx serve .
# then open the printed URL
```

## Deploy to Vercel

The project is a plain static site with no build step. `index.html` sits at the root, so
Vercel serves the lesson at `/` out of the box.

```bash
vercel login
vercel --prod
```

Or import the project at [vercel.com/new](https://vercel.com/new) and deploy with the
default settings — framework preset **Other**, no build command, no output directory.

> The lesson lives at `index.html`, so Vercel serves it at `/` with no routing config.

## Layout

```
index.html               the lesson: scene layers, guide controller, all 47 steps
polygon-data.js          figure geometry traced from the source PDF
support.js               the Design Component runtime that boots the page
screen-navigator.js      optional preview navigator (see note below)
assets/                  artwork actually used at runtime
verification/            headless checks for layout, interactions, audio, voice gating
voiceovers/              narration script and line exports
figs/ uploads/           working files and source material, not deployed
```

### Scene structure

Every layer is positioned as a percentage of one 1980×1080 master stage that is scaled by
a single transform, so the composition holds from 1920×1080 down to 1024×576.

| Layer | z | Position |
|---|---|---|
| Frozen background | 0 | full stage |
| Ambient snow | 1 | full stage |
| Mammoth guide | 20 | 8.28% / 2.22%, 13.59% wide |
| Ice board | 30 | 3.43% / 14.63%, 93.13% wide |
| Learning content | 32 | safe area inset from the ice border |
| Wooden sign | 40 | 22.37% / 0.56%, 55.30% wide |
| Instruction text | 41 | inside the sign's wood band |
| Controls | 42 | top right |

The mammoth sits *behind* the board in real z-order, which is what makes him read as
popping up from behind the ice — there is no mask or clip doing the work.

### Mammoth guide

`MammothGuide` is a reusable character state machine. Screens never pick animations; they
raise semantic events (`onInstructionStart`, `onWrongAttempt`, `onCorrectAnswer`, …) and the
guide chooses the pose. Both sprites share one canvas and every pose animates a single
transform axis, so swapping expression can never move the character's anchor or scale.

## Notes before making this public

- **`screen-navigator.js` ships enabled.** It adds a "Screens · N" button at the top left
  that lets anyone jump to any of the 47 steps. That's useful for a review deploy and
  wrong for a public one — delete its `<script>` tag in `index.html` to disable it.
- **`uploads/` holds source material**, including the lesson PDF the figures were traced
  from. Review the licensing before publishing this project publicly, or delete the folder.
- Progress is deliberately not persisted; the lesson always opens on screen 1.
