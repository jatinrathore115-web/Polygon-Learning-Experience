# Current story scene

The production lesson uses the supplied `assets/image.png` background. The earlier
Shape Studio concept remains a separate design exploration.

## Scene layout

- Left: Swiftee stays perched on the rock. Compact screens place a larger comic
  dialogue bubble to her right; dense activities keep dialogue in the left margin.
- Right: a quiet, pale activity surface preserves the existing 1570 × 701 logical
  learning area. Shape geometry and drag/drop coordinates use the same coordinate system.
- Dialogue has no name tag. It sizes itself to each complete passage, with a fixed
  tail anchor at the bird's head, 46px dark teal text, a teal frame, mint center, and comfortable padding.
  The anchored tail and two comic rays use only HTML/CSS in `styles/dialogue.css`.
  Empty game dialogue is hidden; `design/dialogue-bubble.html` previews the reusable empty shell.
- The 47 steps, questions, correct answers, and recording text remain in `steps()`.

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

The browser check serves the project locally and uses Chrome. Optional ignored
`verification/runtime/*-test-runtime.js` files provide the existing React/Babel dependencies
when the external CDN is unavailable in the test environment. They do not change
production runtime loading.
