# Shapes lesson QA — 23 September 2026

## Scope and fixes

Reviewed all 48 screens without changing approved lesson content or the layout system.

- Fixed an audio-failure dead end: revised lines without bundled recordings could leave the lesson locked when browser speech failed. The failure state now offers **Retry audio** and **Continue without audio**. Normal playback still unlocks only when narration finishes. Continuation is explicit, one-shot, and protected against stale callbacks after navigation.
- Prevented a recovery-button gesture from also triggering the global audio retry handler.
- Fixed repeated completion SFX when exploring the recall polygons after completing the set. The completion sound plays once, and the activity Next remains available.
- Smoothed the shared hover/press helper to 180 ms with easing that does not overshoot.
- Updated regression checks for the 48-screen sequence, the static Summary, automatic counting completion, and the current CFU interactions. No removed Check buttons were restored to satisfy old tests.

## Verification

- Complete browser walkthrough, screens 1–48: passed; keyboard, drag/drop, counting, vertex deformation, sorting, explicit audio recovery, Summary navigation, completion and restart. No JavaScript errors. Local recordings used actual media clocks with accelerated playback; external network requests were blocked.
- Responsive composition: passed **336 combinations** (48 screens × 7 viewport sizes), from 320 × 568 through 2560 × 1080. The 16:9 canvas stays centered and uncropped, with invariant geometry and typography. Touch controls, dragging and rotation also passed.
- All-screen screenshot/contact-sheet review and visible-control overlap/bounds checks: passed, with no overlapping or clipped activity controls in the tested resting states.
- Dialogue and configured feedback pages: passed on desktop and tablet across all 47 narrated screens. The static Summary has no speech bubble. No text overflow or dialogue/content collisions detected.
- Screens 1–9: opening narration → zoom → trace → choices; incorrect-feedback merge waits for narration; cancellation and reduced motion passed.
- Screens 14–15: sequential choices, completed-option cleanup, keyboard handoff, solid recap buttons and reduced motion passed.
- Screens 23–35: label placement, used-label removal, counting, deformation and before/after layouts passed. Screen 31 Check alignment stays within the board.
- Screens 41–42: idle Plus cue, dismissal, one activity Next beside Plus, completion sound once, Summary shapes/names and three viewport sizes passed.
- Sorting activities: 38 intermediate placement/layout states passed.
- Correct/incorrect feedback: 16 activity screens plus label retry passed; one SFX per answer, preserved artwork, reaction cleanup, repeat-tap protection, reduced motion and portrait bounds.
- Teaching motion, all polygon morph endpoints, voice gating, stale-event protection, SFX handling and 1,186 recorded-word boundary checks passed.

Screenshots and machine-readable results are under `verification/output/polish`, `verification/output/launch`, `verification/output/scene-aspect`, and `verification/output/dialogue-frame`.

## Remaining audio review

These updated lines do not have matching bundled recordings. Browser speech is used where available; explicit recovery handles failure. The recording-coverage check intentionally remains failing until matching recordings and word timings are supplied:

1. Tap the closed figure made with straight lines.
2. Great job! You identified all the polygons.
3. Correct! This polygon has 5 sides.
4. That’s right! Quadrilaterals are polygons with 4 sides.
5. Quadrilaterals are polygons with 4 sides.
6. Is this shape a polygon?
7. Not quite! A polygon is closed with only straight sides.
8. Is the boundary straight or curved? (runtime retry question)

Final listening at normal speed and testing on physical iOS/Android devices remain manual release checks. Browser viewport emulation does not establish speaker quality, speech-engine availability, or real-device performance. The completed automated walkthrough is not a claim that every recording has been listened to manually.
