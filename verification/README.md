# Game verification

Run `node verification/check-<name>.cjs` from the project root. The checks use Node; browser checks also use the installed Google Chrome.

Install review tools with `npm ci`. Playwright uses the installed Chrome:

- `npm test`: actual 47-screen playthrough with real audio accelerated to 6x,
  keyboard input, wrong-answer recovery, clicks, drag/drop, steppers, sorting and restart.
- `npm run test:review`: screenshot and accessibility-binding audit of every screen.

Playwright artifacts are saved under `verification/output/launch/`. The playthrough
blocks external services to verify that runtime scripts, fonts, images and audio are local.

- `check-ice-intro.cjs`: opening blizzard — storm build-up, the gust, the settle, input gating, the handoff into screen 1, full cleanup, the wind envelope (with and without a gesture-gated audio context), reduced motion, and that the reveal waits for the artwork. Saves a seeked filmstrip to `output/ice-intro/`.
- `check-guide-sync.cjs`: playback-driven expressions, reaction priorities, recovery and reduced motion.
- `check-interactions.cjs`: all 47 screens, input and keyboard behavior.
- `check-story-scene.cjs`: browser boot, flight, narration reveal, all screens, dialogue fit, tablet and reduced motion.
- `check-board-layout.cjs`: scene bounds and staged visibility.
- `check-teaching-motion.cjs`: side, vertex and angle teaching sequence.
- `check-recorded-voice.cjs` and `check-voice-gate.cjs`: recording lookup, timings and narration gates.
- Other `check-*.cjs` scripts cover individual lesson features.

`output/` holds generated screenshots, preview HTML and JSON reports. Older previews are historical snapshots, not game entrypoints. New outputs are ignored by Git. Generators recreate this directory when needed.

`runtime/` holds optional ignored browser-test copies of React, React DOM and Babel. Production uses the pinned local scripts in `assets/runtime/` and fonts in `assets/fonts/`.

The entire verification folder is excluded from deployment. Edit `../index.html` to change the game.
