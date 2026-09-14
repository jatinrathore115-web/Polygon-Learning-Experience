# Whole-game design review

## Direction: Shape Studio

A bright, playful geometry workshop: warm paper backgrounds, ink-blue outlines, flat pastel labels, and large shapes. Keep Swiftee as a supporting guide in the eventual implementation. Replace the large ice border and wooden sign with a compact lesson header and a spacious activity surface.

Open [concept.html](concept.html) for a standalone, interactive visual exploration with introduction, counting, and selection examples. It is a design prototype, not a replacement lesson. Its demonstration controls and wording are not connected to production narration or progress.

## Review scope

Reviewed the current layout and interaction code covering all 47 steps, plus existing screenshots of teaching, assessment, sorting, and completion screens. Existing screenshots may predate recent edits. This is a design/code review, not a fresh browser and device audit of every screen. Findings below distinguish implemented improvements from remaining work.

## Findings and proposed changes

| Priority | Finding | Evidence / scope | Design change |
|---|---|---|---|
| High | The surrounding artwork competes with the learning object. | The full-stage background, ice board, wooden sign, character, and HUD are repeated across all activities. | Use a quiet warm background and one activity surface. Put instructions in a compact header; reserve strong color for the mathematical feature and primary action. |
| High | Shape scale is inconsistent across the journey. | Recent single-shape layouts use 630–750px boxes; `viewDeform` uses 470px and `viewName` uses 440px. | Define separate layouts for a hero shape, side-by-side comparison, choices, and sorting. Size by visible geometry bounds and room for labels, not one universal percentage. |
| High | Labels do not have one consistent relationship to shapes. | Screens 17–18 now use close, flat pills; naming screens still use `labelPill(..., 540)`. | Use a consistent 20–24px visible-edge gap for names. Use short leaders only for specific sides, vertices, or angles. |
| High | Corrective feedback is inconsistent. | Screen 16 has a gentle override, but shared `cardStyleFor('bad')` retains multiple red shadows. | Use a muted warm border and a brief explanation near the action. Keep the original shape legible and avoid large red fills or repeated shaking. |
| High | Small screens preserve a desktop-sized composition. | Under 700px, `renderVals` enforces a minimum 0.55 scale on a 1980px stage and enables scrolling. | Reflow the header, figure, and controls. Use a two-column choice grid where needed and avoid requiring horizontal scrolling to reach an answer. |
| Medium | Static labels can resemble buttons. | Shared `labelPill` uses a raised shadow and bounce; recent screens override these individually. | Flat labels, outlined secondary controls, and filled primary buttons. Keep these three roles visibly distinct. |
| Medium | Motion is sometimes decorative rather than explanatory. | Shared idle effects and completion cards use repeating pulses; drawing and meeting-edge sequences convey actual concepts. | Animate a feature when it is taught, then let it rest. Keep reduced-motion equivalents across every layout. |
| Medium | Reading time varies across automatic screens. | Screen 17 has a 1.8-second post-narration pause; the general automatic path uses 420ms. | Set reading pauses by content and animation duration. Make replay easy to recognize. Validate timing with students before changing all screens. |
| Medium | Color meaning needs to remain stable. | Parts labels now use amber/purple/teal; shape families and sorting groups use other color schemes. | Reserve amber for Side, purple for Vertex, and teal for Angle in teaching labels. Pair all color meanings with words and geometric cues; use selected checks/borders for answers. |
| Medium | The completion screen misses an opportunity for recall. | `viewEnd` shows six unnamed shapes, a definition, and Play again. | Add each polygon's name and side count. End with a calm, readable summary after a short celebration. |

## Screen groups

| Screens | Design focus |
|---|---|
| 1–9 | Preserve the point-to-shape narrative. Use conspicuous gaps and readable boundaries; keep binary answer controls in a stable location. |
| 10–16 | Align comparison cards and label rows. Keep line-type text on one line where it fits; simplify incorrect feedback consistently. |
| 17–18 | Retain the enlarged hero shape and close name pill. Use this as the introduction layout standard. |
| 19–23 | Preserve the larger teaching shapes, side-to-vertex sequence, and concept colors. Use a distinct selection/drag affordance for the label activity. |
| 24–25 | Retain the zero starting value and shared count/marker value. Group the shape and number control tightly without overlap. |
| 26–33 | Improve the scale of the deformation example and side-by-side comparison. Distinguish draggable handles from teaching markers. |
| 34–41 | Bring naming screens up to the same hero scale and close-label standard; reflow the recall control on narrow screens. |
| 42–46 | Use a consistent choice grid, visible selected states, and one stable Check action. Preserve the sort activity's clear group structure. |
| 47 | Name the six shapes and show their side counts; reduce continuous movement during the summary. |

## Visual foundation

- Background: warm off-white `#F6F4ED`; activity surface: `#FFFFFF`.
- Main text and geometry: deep ink `#24344C`.
- Primary action: violet `#6247C7` with white text.
- Side: amber surface with dark brown text; Vertex: lilac surface with purple text; Angle: mint surface with dark teal text.
- Typography: a rounded, readable sans-serif; use a consistent heading, instruction, label, and control scale. The preview uses system fonts and needs no downloads.
- Corners: 24–32px for large surfaces; 14–18px for controls. Borders are thin except when identifying a selected shape.
- Spacing: multiples of 8px, with optical correction for irregular shape bounds.
- Motion: teach with drawing, convergence, or counting; avoid idle movement during decisions.

## Implementation sequence

1. Agree on the visual direction using the standalone preview.
2. Introduce shared colors, spacing, type, label, button, and feedback styles.
3. Implement four layout families: hero, comparison, choices, and sorting.
4. Migrate screen groups while preserving geometry, answer checking, voice matching, and learning sequence.
5. Verify all 47 screens in initial, active, correct, and incorrect states; check desktop, tablet, narrow portrait, keyboard, and reduced motion.

The production lesson has not been restyled as part of this review.
