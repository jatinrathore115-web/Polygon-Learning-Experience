# Current story scene

The production lesson uses the supplied `assets/image.png` background. The earlier
Shape Studio concept remains a separate design exploration.

`styles/weather.css` adds 16 slow snow particles and six softly twinkling stars at
layer 5, behind the guide and learning surfaces. They cannot capture input. Small
screens use fewer particles; reduced motion hides snow and keeps stars static.

## Scene layout

- Left: Swiftee stays perched on the rock, with dialogue above her head. Compact
  activities allow a wider bubble; dense activities keep it within the left margin.
  Her horizontal center moves from stage x=192 to x=250 (30% farther right).
- Right: a quiet, pale activity surface preserves the existing 1570 × 701 logical
  learning area. Shape geometry and drag/drop coordinates use the same coordinate system.
- Dialogue has no name tag. It sizes itself to each complete passage, with a fixed
  tail anchor at the bird's head, 46px dark teal text, a thin teal border, mint surface, and comfortable padding.
  The softly curved tail uses only CSS in `styles/dialogue.css`; decorative pop lines are removed.
  On narrow screens, bubble width follows the visible viewport while keeping the head anchor.
  Empty game dialogue is hidden; `design/dialogue-bubble.html` previews the reusable empty shell.
- The 47 steps, questions, correct answers, and recording text remain in `steps()`.
- Learning cards use `styles/cards.css`: a pale opaque center, soft inset rim,
  and low-contrast mountain silhouettes confined to the bottom corners.
  A teal outer stroke finishes the frame.
  The scenery scales with the card and never intercepts gameplay input.

## Introduction and progression

1. Background appears with the bird initially hidden.
2. At 80ms, the flapping sprite and 1400ms flight begin.
3. At 1480ms, she settles on the rock with a small snow puff.
4. At 1740ms, dialogue becomes eligible to appear; the bubble waits until text is ready.
5. Narration starts at 2200ms. Actual audio playback reveals the activity, with
   shape cards fading in 80ms apart. Autoplay failure leaves the activity hidden
   until a tap on the game retries narration; no voiceover button is shown.
6. Answer controls appear when narration finishes. Feedback keeps the existing
   controls visible while the normal interaction lock prevents repeated answers.

The bird stays on the rock for subsequent steps. New activity groups briefly reveal
their content in sequence; phases within an activity retain visual continuity.
The point-to-outline drawing intentionally precedes its explanatory narration.
Counting starts from the audio-start callback, and screen 25's readout shares the
side-marker count. Replay retains the current activity. Play again restarts the flight.

With reduced motion, Swiftee is already perched, the surface has no entrance fade,
and the existing teaching animations use their reduced-motion alternatives.

## Files to edit

- `index.html`: `BOARD`, `SAFE`, `LAYER.sign`, `NARR`, and `GUIDE_BOX` position the scene.
- `enterScreen` controls the introduction; `storyVoiceStart` connects playback to content.
- `buildCard` adds short entrance fades without changing shape paths.
- `voiceovers/recorded-player.js` calls `storyVoiceStart` on actual playback.
- `verification/check-story-scene.cjs` checks the real browser introduction, renders
  all 47 screens, measures dialogue pages, and checks tablet/reduced-motion behavior.

The browser check serves the project locally and uses Chrome. Runtime scripts and
fonts ship in `assets/runtime/` and `assets/fonts/`. The opening blizzard uses
`ice-intro.js` and `styles/ice-intro.css`; the bird entrance starts after its gate resolves.
See [LAUNCH_REVIEW.md](LAUNCH_REVIEW.md) for the complete verification scope.
