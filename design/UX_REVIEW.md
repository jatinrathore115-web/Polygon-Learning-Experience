# UI and interaction review — 14 September 2026

The desktop layout has a clear visual direction. The most useful changes are stronger emphasis on the teaching figure, clearer actions and less competing motion.

| Finding | Change applied |
| --- | --- |
| Screen 23's labeling figure occupied too little of its board. | Increased its dimensions from 470 to 660 stage pixels (40%), keeping the feature markers attached and the options separate. |
| Question marks did not explain the drag-or-tap interaction. | Added one short instruction, which changes to a placement hint after a label is selected. |
| The three targets had indistinguishable accessible names. | Named them by position without revealing the correct answer; selected labels expose their pressed state. |
| Already placed labels still appeared in keyboard navigation as available actions. | Removed their click/drag handlers and focus stops while retaining their learning colors. |
| Every active card pulsed continuously, competing with the shape and narration. | Removed idle card pulses. Primary buttons receive one brief entrance effect; hover, focus, press and teaching feedback remain. |
| Faded disabled controls lost text contrast. | Gave unavailable controls a muted solid surface with readable dark text. Correctly placed label colors remain unchanged. |

## Verification

The Playwright screenshot audit rendered all 47 screens with zero browser errors or failed requests. Screens 23 and 24 were visually inspected after the changes. Focused interaction, label-drop and feedback checks passed. The full Playwright lesson also exercises distinct label-target names, real dragging, keyboard label selection and removal of used choices from the focus order.

Updated screenshots: `verification/output/launch/screen-23.png` and `screen-24.png`.

## Remaining design limitation

Narrow portrait phones still use a horizontally scrollable lesson stage. A dedicated portrait layout would let learners see the dialogue and activity together; this remains the largest responsive-design improvement. The current desktop/landscape layout and a functional phone touch check are not a substitute for that redesign.

These changes are in the local game. Publication still requires the previously requested explicit repository/branch approval.
