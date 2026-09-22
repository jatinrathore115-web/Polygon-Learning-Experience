# Polygon Learning Experience

**Looking for a file or screen? Open [STRUCTURE.md](STRUCTURE.md) for the project tree, screen 1–47 map, and exact function names to search.**

An interactive polygon lesson for young learners — a frozen-scene game screen where
Swiftee, a bird perched on the left rock, speaks through a dialogue bubble, watches
the learner work, and reacts to their answers. 47 screens covering open/closed figures,
straight vs curved boundaries, sides, vertices, angles, and polygon naming from triangle
to octagon.

Static site — no build step. Runtime scripts and fonts ship locally; Playwright is a development dependency.

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

Deploy the complete project, including `assets/`, `styles/`, `responsive-layout.js`,
and the scripts and MP3s in `voiceovers/`. Required scripts and styles load before
lesson startup. `vercel.json` revalidates files on new requests so a new release
does not keep using stale scripts or voice cues. Other static hosts should apply
the same `Cache-Control: public, max-age=0, must-revalidate` policy.

A fresh browser may block automatic audio. The lesson keeps the current instruction
and offers **Tap to play audio**; it resumes that instruction after a gesture instead
of skipping ahead on an estimated timer. Failed downloads use the same retry path.
All current lesson prompts and configured answer feedback have matching local audio.
Three previously unrecorded questions use bundled WAVs generated with Microsoft Zira
Desktop; their word cues come from synthesis events. The quadrilateral success response
reuses the existing recorded encouragement. `voiceovers/build-fallback-audio.ps1`
recreates the WAVs on Windows; `voiceovers/recordings.js` is the deployed catalog.

## Layout

```
index.html               the lesson: scene layers, guide controller, all 47 steps
polygon-data.js          figure geometry traced from the source PDF
support.js               the Design Component runtime that boots the page
screen-navigator.js      optional preview navigator (see note below)
responsive-layout.js     viewport fitting and readable portrait activity layouts
build-swiftee.cjs        regenerates assets/swiftee/ from the character pack
styles/buttons.css       warm button effects, hover, press and focus states
styles/dialogue.css      soft speech bubble, anchored to Swiftee
styles/cards.css         quiet winter card design
styles/weather.css       gentle snow and star motion
styles/ice-intro.css     the blizzard cinematic: every layer and its timing
ice-intro.js             blizzard particles, wind audio, and the lesson handoff
assets/runtime/          pinned React, React DOM and Babel runtime scripts
assets/fonts/            local Baloo 2 and Nunito fonts
assets/                  artwork actually used at runtime
assets/swiftee/          the guide's sheets plus the generated sheet table
reference/              source artwork, old UI, uploads and working figures
verification/            checks; output/ holds previews and results
voiceovers/              narration script and line exports
design/                  design review and standalone concept, not deployed
```

### Scene structure

Landscape learning content fits a 1980×1113.75 (16:9) master stage. Portrait screens
reflow the dialogue and activities, with vertical scrolling when needed for readable
text. A single scenic image covers the entire viewport independently of the content;
its 16:9 proportions stay intact, with only decorative edges cropped.

| Layer | z | Position |
|---|---|---|
| Starry background (`assets/image.png`) | 0 | full viewport |
| Swiftee guide | 20 | left rock; feet at stage (192, 824) |
| Activity surface | 30 | right of the guide, stage (378, 122) |
| Learning content | 32 | stage (390, 172), 1570 × 701 logical pixels |
| Dialogue bubble | 40 | comic bubble right of the bird on compact screens; left margin on dense activities |
| Instruction text | 40 | natural text flow, with consistent padding inside the bubble |

Swiftee flies in once at the start, lands on the rock, and stays there between activities.
The nameless dialogue fits each complete text passage. Its teal frame, mint center,
rounded speech tail anchored to Swiftee's head are defined in [styles/dialogue.css](styles/dialogue.css).
An empty reusable version is available in [design/dialogue-bubble.html](design/dialogue-bubble.html).
It stays hidden when empty and appears after landing when text is ready. Real audio playback reveals the activity surface and
staggered shape cards; answer controls appear after narration ends. Existing feature
animations keep their narration cues. Reduced motion skips the flight and entrance fades.
See [design/STORY_SCENE.md](design/STORY_SCENE.md) for timing and verification details.

### Swiftee, the guide

She sits on the left rock and speaks through the dialogue above her. Her talking
animation follows actual audio playback, then settles into watching the learner work.

Two layers do the work, both in `index.html`:

- **`SwifteeSprite`** blits frames from the pack's uniform-grid sheets onto one canvas at
  the manifest's 20 fps and runs a queue of segments. Frame `i` sits at
  `col = i % cols, row = i / cols`, the pivot is the cell centre, and the canvas is always
  the whole cell — so every expression shares one registration and swapping one for
  another cannot move her a pixel.
- **`SwifteeGuide`** is the state machine the screens talk to. They never pick an
  animation; they raise semantic events (`onInstructionStart`, `onWrongAttempt`,
  `onCorrectAnswer`, `onHint`, …) and the guide chooses the expression, plays it to the
  end, and queues the ambient pose behind it.

Every state plays its full `start → loop → stop` triad, so no loop is ever cut straight
into another. What she does, and when:

| moment | expression |
|---|---|
| a new screen | `flapping` — she flies in; on the first screen she waves hello |
| audio is playing | `talking`, following actual playback events |
| audio is loading, paused, or blocked | `blinking` ? listening |
| dragging, counting, or choosing a label | a brief `curious` reaction |
| part of a task completed | `happy`, with `proud` for every third placement |
| the learner is working | `blinking` |
| first wrong answer | `confused` — encouraging, never punishing |
| wrong again on the same question | `puzzleing` |
| right first time | `happy` |
| right after a miss | `relieved` |
| a hand hint appears | `curious` |
| spoken "Whoa" / "Wow", or the first POLYGON reveal | `surprised`, at the word cue |
| a new polygon name is spoken | a brief `proud` reaction |
| left alone for 24s | `daydreaming`, until the next tap |
| lesson complete | `proud`, then `celebrating` |

The guide counts misses itself rather than reading the lesson's attempt tally — the
screens bump that inside the same `setState` that precedes the call, so a first miss would
otherwise read as a second one.

Under `prefers-reduced-motion` she still changes expression, because that is the feedback,
but nothing loops: each pose is held on a single frame, and the fly-in, the speaking lean
and the entrance fades stop moving.

### The blizzard intro

The lesson opens on a cinematic. `assets/INTRO IMAGE.png` fades up out of the dark, wind
rises, snow builds to a blizzard peak with a gust crossing the ice, then the storm settles
and the scene crossfades into the lesson. It runs 5.8 seconds and then takes itself out
completely — DOM, timers and audio.

It is an overlay, not a change to the lesson. The only line it touches is in `boot()`: the
ice board lays itself out immediately so the cinematic has the real screen to crossfade
into, but screen 1 waits on `IceIntro.gate`, so no narration, entrance or input happens
underneath it.

Retune it from `#ice-intro` in [styles/ice-intro.css](styles/ice-intro.css).
`--intro-duration` retimes the whole sequence including the wind, because
[ice-intro.js](ice-intro.js) reads it and expresses every beat as a fraction of it.
`--wind-tilt` is the one wind direction that the mist gradients, the streak rotations and
every particle vector are derived from, so the storm cannot end up blowing two ways.

Three things in it are deliberate and easy to undo by accident:

- **The particle containers have no opacity animation.** Fading a layer that holds a
  hundred moving children makes the browser composite them as one group every frame, which
  cost about two thirds of the frame budget on integrated graphics. Instead every flake has
  its own arrival and departure, so the storm builds and settles because flakes start and
  stop coming — `arrive` and `cease` in each `FIELDS` entry. It is cheaper and it looks
  more like weather.
- **Nothing uses `filter: blur()`.** The out-of-focus softness is in the colour stops. Per
  element, blur was the single most expensive thing in the file.
- **The distant layer is tiled dot sheets, not elements.** Each drifts a whole number of
  tiles, so the pattern lands exactly on itself and the loop cannot be seen, and each is
  grown by its own travel so it still covers the screen at both ends of the drift.

Flakes are near-opaque white with a cool rim on purpose: the artwork is an almost-white ice
field, and faint white snow on it is simply not visible. The `--storm-shade` wash takes the
field down far enough for snow to read, and `--lesson-night` brings the light down to meet
the lesson's night scene so the crossfade is not a jump in brightness.

Skip it with `?intro=0`; `?preview=1` skips it too, so authoring screens is not gated
behind a six-second cinematic. `node verification/check-ice-intro.cjs` asserts the
build-up, the gust, the settle, the handoff, the cleanup and the wind envelope, and writes
a filmstrip to `verification/output/ice-intro/`.

### Screen 1, the point intro

The lesson opens on a single mark, which then draws a shape. Three numbers hold
that sequence together, and `verification/check-point-intro.cjs` asserts all of
them:

- **The point waits where the shape will be centred.** It is placed on the centre
  of the leaf's own bounding box, not on the first vertex, so it reads as the
  middle of the composition rather than as something floating near the top.
- **The ripples settle at the height the shape will fill.** The mark claims
  exactly the room the drawing is about to take, so the white around it reads as
  space rather than as nothing.
- **The caption does not move.** "Point" and "Shape" are the same size at the
  same position, so only the word changes between the two phases.

Nothing jumps on the way in. When the draw begins, the mark does not blink out
and reappear at the shape's first vertex: it travels there over
`S1_TRAVEL` milliseconds, shrinking into the pen light that traces the outline,
so the learner follows one object out of the centre and into the drawing.

The point, the drawing, the close-up and the trace all share one box, so nothing
shifts between them. The question is the exception — it needs the lower third for
its Open and Closed controls, so it keeps a smaller, higher box, and that arrives
with the magic reveal every other question uses rather than as a jump.

Under `prefers-reduced-motion` the ripples are not drawn at all, the mark neither
appears nor breathes, and the travel is skipped: the pen simply starts at the
vertex.

### The open-or-closed questions

Five screens ask whether a single figure is open or closed. What the sign says
about the answer is also shown on the shape, because a child cannot be asked to
take the sentence on trust. `verification/check-open-closed.cjs` asserts both
halves of that.

**"There is a gap in its boundary."** The gap is marked where it actually is:
a white-cored red cap on each of the two places the boundary stops, a halo
pulsing out of each, and the missing span between them drawn as a dashed red
line, haloed in white so it separates from the outline underneath. It is dashed
so it can never be read as boundary. The two loose ends are read from the figure
itself — the first and last point of the stroke the trace follows, which for a
path figure includes the little end flicks the outline draws — so the marks
cannot drift away from the geometry. They agree with the `gap` midpoints in
`polygon-data.js` to within a few units. The same marks appear whether the
learner got it wrong or right, so being right still shows why.

**A correct "Closed"** runs a light the whole way round the boundary, twice,
over a green glow on the outline itself. Arriving back where it started is the
thing that makes a boundary closed, so the answer is shown rather than only
outlined on the button. The light fades out at the end of its lap instead of
parking a bright segment on the shape. A closed figure answered *wrongly*
already gets the blue trace, which runs the same lap for the same reason, so
nothing is stacked on top of it.

Under `prefers-reduced-motion` the gap is still marked and simply does not move;
the closed boundary neither pulses nor runs its light.

### The four-up compare screens

Four figures sit side by side while the lesson names what they have in common
and then what differs. On **"Look! The boundaries of the shapes are different
too."** all four boundaries light at once, in one shared colour rather than each
figure's own, because the job of that line is to name the thing every one of
them has. They draw themselves on together over `BOUND_DRAW` milliseconds and
then hold, glowing, for the rest of the sentence — the word "boundaries" lands
about 1.9 seconds in, so the thing it names is on screen when it arrives. The
next line splits them into straight and curved, so the shared colour ends with
this step.

The resting value of that light is *fully drawn*, with the draw-on played as an
animation over the top of it. That ordering matters: a re-render can restart a
CSS animation, and if the finished state lived only in the animation's forwards
fill, anything that re-rendered the board mid-sentence would send the boundaries
back to dark and redraw them. The board does re-render mid-sentence whenever the
voice is blocked and the "Play voiceover" fallback appears. With the resting
value already lit, the worst such a re-render can do is replay the draw.

The sign's text arrives a word at a time on this line as on every other, paused
until the voice actually starts, and driven by per-word timings from the
recording where one exists. `verification/check-word-animation.cjs` covers that
for all 47 lines; `verification/check-boundaries.cjs` covers this screen, and
measures the held light in a real browser rather than from a style object.

### Regenerating the guide's sheets

`assets/swiftee/` is generated, not hand-made. `build-swiftee.cjs` reads
`reference/swiftee-assets/swiftee-assets/atlas/swiftee.manifest.json` — the single source of truth for frame counts,
grids, frame rate and the start/loop/stop triads — copies the @1x sheets for the
expressions the lesson actually plays, and writes `swiftee-sheets.js`, the `window.SWIFTEE`
table the page reads. Nothing about the sheets is hardcoded in `index.html`.

```bash
node build-swiftee.cjs        # 36 sheets + the table, ~1.3 MB
```

Edit the `SHIP` list in that script to add or drop an expression. The table loads from the
document head rather than the helmet, because the lesson script reads it while it is being
evaluated. If it is missing the guide layer simply does not render — the lesson is
otherwise unchanged.

### Verifying the guide

```bash
node verification/check-guide-sync.cjs
node verification/check-story-scene.cjs
```

The guide check exercises delayed playback, pauses, failure and retry, spoken word
cues, answer priority, recovery after mistakes, progress, idle, finale, and reduced
motion. The scene check verifies the actual browser render and all 47 screens.

## Notes before making this public

- **`screen-navigator.js` ships enabled.** It adds a "Screens · N" button at the top left
  that lets anyone jump to any of the 47 steps. That's useful for a review deploy and
  wrong for a public one — delete its `<script>` tag in `index.html` to disable it.
- **`reference/uploads/` holds source material**, including the lesson PDF the figures were traced
  from. Review the licensing before publishing this project publicly, or delete the folder.
- Progress is deliberately not persisted; the lesson always opens on screen 1.
- Previous UI artwork is preserved in `reference/legacy-ui/` and excluded from deployment.
- See [verification/README.md](verification/README.md) for checks and generated output.
