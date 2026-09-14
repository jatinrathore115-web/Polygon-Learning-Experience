# Find files and screen code

**Start with [index.html](index.html). All 47 lesson screens live in this file.** There are no separate screen HTML files. Use your editor's Find command to jump to the function names below.

The displayed screen number is the position in `steps()` (starting at 1). Internal IDs such as `S13` are lesson groups, not displayed screen numbers: screens 24 and 25 both use `S13`.

## Project files

```text
Polygon Learning Experience/
|-- index.html                 Main lesson: styles, template, interactions, screens
|-- polygon-data.js            Shape coordinates, geometry, and colors
|-- screen-navigator.js        Preview menu for jumping to a screen
|-- support.js                 Generated runtime used to load the lesson
|-- README.md                  How to run and deploy the project
|-- STRUCTURE.md               This file guide and screen map
|-- vercel.json                Deployment configuration
|-- build-swiftee.cjs          Character asset generation script
|-- styles/buttons.css         Shared button effects and interaction states
|-- styles/dialogue.css        Reusable Swiftee-colored comic dialogue bubble
|-- styles/cards.css           Quiet snowy silhouettes and learning card frame
|-- styles/weather.css         Gentle falling snow and background star twinkles
|-- styles/fonts.css           Local font-face definitions
|-- package.json               Playwright review commands and development dependencies
|-- assets/                    Images used by the lesson
|   |-- image.png              Current starry background with the left rock
|   `-- swiftee/               Character sprites and sprite metadata
|-- voiceovers/
|   |-- recorded-player.js     Audio playback and word timing synchronization
|   |-- recordings.js          Recording lookup and aligned word timestamps
|   |-- voice overs/           Audio recordings
|   |-- narrator-script.txt    Narration text export
|   |-- narrator-lines.csv     Narration spreadsheet export
|   |-- narrator-lines.json    Narration data export
|   |-- export-visible-lines.cjs  Script that exports narration
|   `-- WORD-TIMINGS.md         Word alignment notes
|-- verification/              Runnable checks (see verification/README.md)
|   |-- output/                Generated previews, screenshots, and results
|   `-- runtime/               Optional local browser-test dependencies
|-- design/                    Design review and standalone visual concept
|   `-- dialogue-bubble.html   Empty HTML/CSS bubble preview
`-- reference/                 Source material, excluded from deployment
    |-- legacy-ui/             Previous backgrounds, panels and guide artwork
    |-- swiftee-assets/        Source character artwork pack
    |-- figs/                  Local working/reference images
    `-- uploads/               Source PDFs and uploaded reference material
```

## Which file should I edit?

| Change | File and search term |
|---|---|
| Screen heading, question, correct answer, or screen order | [index.html](index.html): `steps()` |
| Shape size, position, labels, or screen-specific colors | [index.html](index.html): use the screen map below |
| Compact opening cards and external answers | [index.html](index.html): `ocBox`, `fitActivityPanel`, `exploreOutline` |
| Shared shape cards and outlines | [index.html](index.html): `buildCard(o)` |
| Polygon label pill | [index.html](index.html): `labelPill(text, top)`; individual screens also override its style |
| Side / Vertex / Angle label colors | [index.html](index.html): `labelTheme(name)` and the palette inside `viewParts` |
| Number input and Check behavior | [index.html](index.html): `counter(i, caption)`, `bump(i, d)`, `checkCount()` |
| Counting animation | [index.html](index.html): `countSides(n, which)` |
| Shape coordinates | [polygon-data.js](polygon-data.js): `FIG` |
| Audio synchronization | [voiceovers/recorded-player.js](voiceovers/recorded-player.js) |
| Recording timestamps | [voiceovers/recordings.js](voiceovers/recordings.js) |
| Screen jump menu | [screen-navigator.js](screen-navigator.js) |
| Background, dialogue bubble, and bird landing | [index.html](index.html): `BOARD`, `LAYER.sign`, `GUIDE_BOX`, `enterScreen`, `storyVoiceStart`; see [story scene notes](design/STORY_SCENE.md) |

Narration text is matched to recordings by wording. When changing a spoken sentence, check its recording entry too.

## Screen map

All functions in this table are in [index.html](index.html). Search the exact function name in your editor.

| Displayed screen | Content | Internal ID / phase | Layout function |
|---|---|---|---|
| 1–5 | Point, drawing, boundary, open/closed question | `S1` | `viewS1` |
| 6–9 | Open/closed questions | `S2`–`S5` | `viewOC` |
| 10–15 | Open/closed and straight/curved comparison | `S6` | `viewCompare`, `cmpCards` |
| 16 | Find the polygon | `S7` | `viewTapOne`, `cmpCards` |
| 17 | POLYGON reveal | `S8` | `viewReveal` |
| 18 | Polygon definition and outline | `S9` | `viewBuild` |
| 19 | Select polygons | `S10` | `viewMulti` |
| 20 | Introduce Side | `S11`, `sides` | `viewParts` |
| 21 | Introduce Vertex | `S11`, `vertex` | `viewParts` |
| 22 | Introduce Angle | `S11`, `angle` | `viewParts` |
| 23 | Label polygon parts | `S12` | `viewLabels`, `labelTheme` |
| 24 | Enter the number of sides | `S13`, question | `viewCount`, `counter` |
| 25 | Animate counting five sides | `S13`, `five` | `viewCount`, `countSides` |
| 26–28 | Change shape / drag a vertex | `S14` | `viewDeform` |
| 29–30 | Before and after | `S15` | `viewBA` |
| 31–33 | Count again / still five / naming | `S16` | `viewBA` |
| 34–35 | Triangle / Quadrilateral | `S17` | `viewName` |
| 36 | Select quadrilaterals | `S18` | `viewMulti` |
| 37–40 | Pentagon / Hexagon / Heptagon / Octagon | `S19`–`S22` | `viewName` |
| 41 | Recall polygon names | `S23` | `viewRecall` |
| 42 | Select polygons | `C1` | `viewMulti` |
| 43 | Sort polygon / not polygon | `C2` | `viewSort` |
| 44 | Find the non-polygon | `C3` | `viewTapOne` |
| 45 | Select pentagons | `C4` | `viewMulti` |
| 46 | Sort hexagons / heptagons | `C5` | `viewSort` |
| 47 | Completion | `END` | `viewEnd` |

## Verification files

For the proposed new visual style, open [design/concept.html](design/concept.html). The findings and rollout plan are in [design/DESIGN_REVIEW.md](design/DESIGN_REVIEW.md).

Run these from the project folder using Node:

```text
node verification/check-guide-sync.cjs
node verification/check-story-scene.cjs
node verification/check-board-layout.cjs
node verification/check-interactions.cjs
node verification/check-teaching-motion.cjs
node verification/check-label-drop.cjs
node verification/check-recorded-voice.cjs
```

- `check-interactions.cjs`: screen interactions and keyboard behavior.
- `check-teaching-motion.cjs`: Side / Vertex / Angle timing and layout.
- `check-label-drop.cjs`: label placement and drag behavior.
- `check-recorded-voice.cjs`: recording lookup, word timing, and playback behavior.
- Other `check-*.cjs` files cover specific lesson features. Preview HTML, screenshots, and result files live in `verification/output/`; they are artifacts, not lesson source.

`support.js` is generated runtime code. Make lesson changes in `index.html` and the relevant data or playback files.
