# Shared game buttons

The button family uses Swiftee's teal and the scene's warm gold, with rounded rectangular shapes, dark teal text, a fine border and a short raised base.

| Role | Treatment |
| --- | --- |
| Answers, Check, Next, Play again | Soft gold fill, teal border and raised teal base |
| Dropdowns, menu options, plus/minus | Mint fill with the same edge, typography and depth |
| Side, Vertex, Angle | Existing teaching colors, with shared button proportions and shadow |
| Unavailable | Muted mint surface, readable text, no hover or press effect |
| Correct / incorrect answers | Soft green / peach surfaces and borders, with fully opaque text |

`BUTTON` and `buttonSkin()` in `index.html` own the shared surface styles. Screen builders supply their dimensions and any teaching/feedback colors. `styles/buttons.css` owns hover, press, keyboard focus and reduced-motion behavior.
The optional screen-preview navigator also reads `buttonSkin()` instead of keeping its own orange button palette.

Primary buttons have a single gentle entrance effect. Hover lifts are restrained; focus uses a clear dark teal outline. Labels retain their colors when moved or placed. The larger answer buttons use 28px corner radii; regular actions use 24px, and compact controls use 16–22px.

Verification: all 47 screens rendered in Playwright without page errors or failed requests; the complete lesson playthrough passed keyboard input, dropdowns, drag/drop, counting, sorting, touch, rotation and restart. Focused checks verify interaction gates, label placement, idle feedback and contrast across both actual button gradients.

`npm run test:review` additionally captures correct, incorrect, disabled, enabled and keyboard-focus states, and checks the phone counter's 44px touch area. State screenshots are saved as `verification/output/launch/buttons-*.png`. The phone check uses the existing scrollable stage; it does not certify a dedicated portrait layout.
