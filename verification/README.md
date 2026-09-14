# Game verification

Run `node verification/check-<name>.cjs` from the project root. The checks use Node; browser checks also use the installed Google Chrome.

- `check-guide-sync.cjs`: playback-driven expressions, reaction priorities, recovery and reduced motion.
- `check-interactions.cjs`: all 47 screens, input and keyboard behavior.
- `check-story-scene.cjs`: browser boot, flight, narration reveal, all screens, dialogue fit, tablet and reduced motion.
- `check-board-layout.cjs`: scene bounds and staged visibility.
- `check-teaching-motion.cjs`: side, vertex and angle teaching sequence.
- `check-recorded-voice.cjs` and `check-voice-gate.cjs`: recording lookup, timings and narration gates.
- Other `check-*.cjs` scripts cover individual lesson features.

`output/` holds generated screenshots, preview HTML and JSON reports. Older previews are historical snapshots, not game entrypoints. New outputs are ignored by Git. Generators recreate this directory when needed.

`runtime/` holds optional ignored browser-test copies of React, React DOM and Babel. The story check uses these if present, otherwise the page uses its configured CDN. These files are not production dependencies.

The entire verification folder is excluded from deployment. Edit `../index.html` to change the game.
