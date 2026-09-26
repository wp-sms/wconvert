# Journey B visual and interaction parity correction

September 26, 2026. The owner's toolbar screenshots exposed an incorrect
completion claim: behavioral coverage and passing suites did not establish
visual or interaction parity with B. Merchant feedback is not a substitute
for completing observable prototype details. This review reopens that work.

Compared the running prototype at `:5188/?prototype=flow&variant=B&scenario=garden`
with the real WordPress quiz and multi-interest QA drafts in Chrome. Also
exercised the plugin at 390px and 320px in the in-app browser.

## Corrected in this pass

| B detail previously missing or flattened | Production change | Verification |
| --- | --- | --- |
| Compact, separate canvas control groups | Floating icon-and-label view tools, separate zoom controls and explicit pan controls; removed the full-width button footer | Actual desktop screenshot, pan action, responsive DOM measurements |
| Related paths highlighted / Focus selection | Toggle relationship highlighting; screen selection includes neighbours, path selection includes downstream connections; focus returns to a readable local view | Browser toggle/focus; unit scenarios for an exclusive branch joining a shared ending, no selection and malformed cyclic draft |
| Follow-up grouping action communicates what the click does | Expand follow-ups changes to Group follow-ups after expansion | Real enquiry: six individual cards expand from three cards plus one follow-up group, then regroup |
| Icons and ending cue help distinguish screen types | Type icons and Journey complete footer on ending cards | Desktop quiz and grouped enquiry screenshots |
| Explain how a screen is reached separately from its visibility rule | Collapsible Arrives from summary links each incoming default, answer or hidden connection to its original source path | Browser incoming-route navigation and focused tests, including unordered storage and hidden/default paths |
| Controls must not cover a focused card | Fit/start/focus reserve actual control height; keyboard reveal respects the control area | Desktop selected card bottom 628.6 / controls top 640.5; phone preview card bottom 647.7 / controls top 659.8 |
| Compact controls follow available canvas space, including inspector width | Container queries switch view actions into a menu while keeping zoom and Fit journey available | 390px: 324px map height, zero document overflow; 320px: 289px control group fits inside the canvas |

The compact menu's Screen previews action updates the map and returns focus to
View options. At phone width, screen search opens the correct inspector, Map
returns to the canvas, and Add offer screen opens the insertion dialog; Escape
cancels it and returns focus to Add screen. No campaign content was saved,
published or submitted during these checks. Grouping, previews, camera movement
and highlighting are local view state.

## Still open — do not claim full B parity

1. **Contextual screen actions.** B offers screen preview and edit/add actions
   directly on selected cards. Production still relies on the main toolbar,
   inspector and Design navigation. A direct preview must use the production
   renderer and accurately distinguish a screen preview from a complete visit.
2. **Insertion on a connection.** B exposes a contextual insertion action on
   the line. Production has insertion from Next screen settings and the main
   Add screen dialog, but the canvas shortcut itself is absent.
3. **Low-zoom presentation.** B changes cards to readable summaries as the
   overview shrinks. Production retains scaled detailed cards. Inspect long
   branches and text before deciding the exact threshold and retained details.
4. **Inspector and modal hierarchy.** B uses more compact incoming/visibility
   summaries and contextual controls. This pass checked the insertion dialog
   and added incoming context, but did not establish parity for every screen,
   path, result, removal and replacement state. Compare those states directly;
   list deliberate production differences and evidence, not inferred parity.

These are implementation/audit tasks, not blockers waiting on merchant input.
The owner has waived GitHub CI and deferred VoiceOver as unverified; those
choices do not waive visual and interaction parity.

## Checks

66 focused JS tests across five files, TypeScript, ESLint, Free/Pro admin builds,
source contract and whitespace checks pass. The earlier full JS/PHP and package
results predate this admin-only correction. No visitor runtime or PHP code was
changed in this pass. Browser screenshots and interactions above supply the
visual evidence that unit tests do not.
