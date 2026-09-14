# Launch review — 14 September 2026

## Implemented

- [x] Shift Swiftee right on the rock and anchor the softer mint dialogue tail to her head.
- [x] Keep readable dark text, content-sized dialogue, warm buttons and quiet winter card decoration.
- [x] Preserve staged lesson reveals, expressions, falling snow and background stars.
- [x] Include the blizzard intro, with lesson narration starting after its overlay releases control.
- [x] Repair template bindings so buttons receive their intended styles, keyboard roles and focus states.
- [x] Raise counting controls above SVG hit areas while keeping empty control-row space click-through.
- [x] Replace strong incorrect-answer glows with pale feedback and a subtle shadow.
- [x] Bundle pinned runtime scripts and fonts locally, removing external CDN/font availability dependencies.
- [x] Show a dialogue cue when browser audio needs a user gesture; retain the existing tap-to-retry behavior.
- [x] Hide the screen-jump tool from the student production view. Authors can use `?preview=1`.

## Verification

- [x] Playwright completed the 47-screen lesson using actual clicks, keyboard input, dragging, counting, sorting, feedback and restart. Recorded audio ran at 6x to shorten the test while retaining its real timing and completion events.
- [x] External requests were blocked during the playthrough; bundled assets worked without those services.
- [x] Playwright rendered all 47 screens with no page errors or failed requests.
- [x] Browser scene checks covered all 47 screens and 90 dialogue pages, flight/reveal timing, tablet bounds and reduced motion.
- [x] Touch counting worked at 390×844 and after rotating to 844×390.
- [x] Intro checks passed at 1920×1080, 1366×768 and 900×620, including clean DOM/animation teardown and lesson handoff.
- [x] Fourteen focused checks covered guide sync, interactions, layout, teaching motion, recordings, voice gates, point/drawing, open/closed, morphing, labels, idle feedback, sorting, sound and word animation.

Browser scope: installed Chrome through Playwright and the existing Chrome scene checks. This is not a claim of Safari/Firefox or physical-device certification. Narrow portrait phones retain the game's existing scrollable stage; landscape gives the clearest complete view.

## Reproduce

Run `npm ci`, then `npm test`, `npm run test:review`, and `npm run test:scene`.
Run `node verification/check-ice-intro.cjs` for the intro timeline.
Run `node verification/playwright-smoke.cjs` for fresh-session audio recovery, or append a deployed URL to check production and its hidden authoring navigation.

Reports and screenshots are generated in `verification/output/launch/` and `verification/output/ice-intro/`; these files stay out of Git and deployment.
