# Journey interaction acceptance — reopened September 27

The original goal is unfinished. Creating another goal would obscure the same
unfulfilled requirement. The stored goal is blocked from an earlier checkpoint;
its prototype-parity objective remains the scope. PR #190 stays draft and unmerged.
The owner should not have to identify each remaining mismatch.

## Why the earlier audit was insufficient

It checked feature availability and overclaimed experience parity. B's interaction
hierarchy also matters: where an action starts, which choices appear first, what
stays in context, and whether a merchant can finish without switching workspaces.
Test counts alone do not establish those qualities.

## State-by-state findings and implemented changes

| Workflow | Observed mismatch | Current implementation |
| --- | --- | --- |
| Toolbar Add screen | Extra menu before another type picker | Direct chooser; older ordered campaigns first receive an explicit draft upgrade with Cancel and Undo. Ordered actions remain available. |
| Add from a connection | Full location selector competes with known context | Source and destination shown first; Change location discloses the selector. |
| Choose screen type | Dropdown hides meanings; Collect details absent | Four described icon choices with selected states. Capture uses existing ownership or the optional-signup workflow. |
| Existing contact screen | Adding contact collection can imply duplicating an existing save | If contact already follows the connection, Edit existing opens that screen without changing the graph. |
| Relevant follow-up | Forces a question even for an explanatory message | Conditional question or message uses the same skip/rejoin semantics. |
| Question inspector | Metadata and expanded conditions before the question; nested boxed form | Question and choices first; visibility summarized; supporting copy and structural settings disclosed. |
| Message/capture/ending inspector | Heading, message and button copy require Design | Edit existing plain copy in place. Preserve IDs, layout, tokens, submission ownership and actions. Formatted slots remain in Design; hidden copy is omitted. |
| Inspector context | Visibility confined to Content; outgoing branch count absent | Arrival/visibility stay above Content/Next screen. Outgoing summary names answer-path count and Everyone else. |
| Screen options | Routine content competes with structural controls | Rename, save assignment, duplicate and move sit in optional settings; repair links reveal the relevant control. |
| Path inspector | Multiple full forms compete for attention | Readable priority/condition/destination summaries; focused path opens. Insertion uses the same contextual chooser. |
| Display/destination context | Edit links leave Journey | Real configuration editors open beside the map. They share the campaign draft and validation with the full tabs. Close returns to selection and restores invoking focus. Shared destination setup retains its separate live-save warning. |
| Result inspector | Settings order competes with result content | Selected result copy/products precede conditions; result access follows result editing. |
| Workspace height | Separate title/actions and view/search rows reduce useful editor space | One wrapping toolbar; 380px inspector on desktop. Narrow layouts retain Map/Edit screen navigation. |

These changes are implemented, not a declaration that every acceptance state has
passed. In particular, the contextual editors and final toolbar need the final
browser comparison below.

## Evidence and crash recovery

Before interruption, the running prototype and production were compared for Add
screen, selected conditional questions, supporting copy and toolbar/panel hierarchy.
The user's active welcome-discount campaign was also inspected read-only: it uses
the older ordered model. It was not migrated or saved during this work.

The computer crash preserved all source edits but stopped the local services and
erased temporary logs. After recovery:

- Corrected a test fixture that attempted unsupported hidden layout/button nodes.
- TypeScript and ESLint passed on the recovered source.
- Seven focused suites passed: **576 tests**, including legacy upgrade/Cancel/Undo,
  contextual panel focus and selection retention, compact display-rule editing,
  copy identity/action preservation, conditional message traversal, and repairs.
- Free and Pro admin builds passed. The existing large-chunk advisory remains.
- Local WordPress and the B prototype server were restored.
- Browser automation failed repeatedly during startup with “Unable to load browser
  request-header policy.” No bypass was attempted. Therefore the post-build
  browser acceptance states below are **unverified**, not passed.
- Full local JS suite: **168 files / 3,080 tests passed** after recovery, with one worker.
- Final Free/Pro admin rebuilds and Free/Basic/Pro/Elite packaging passed; all
  artifact contracts passed. No PHP or visitor-loader source changed in this pass.
- A final browser retry after these checks failed with the same startup error.

## Remaining acceptance work — do before closing the goal

1. Compare B and the built plugin at the same desktop viewport: direct Add,
   connection Add, conditional question/message, new/existing capture, and ending.
   Check initial, selected, unavailable, Cancel, applied and Undo states.
2. Inspect message, question, capture, result and ending panels. Confirm the main
   task is visible without needless scrolling; exercise disclosure and repair
   focus, edited preview, and changing selection.
3. Exercise real display settings in the side panel: opening, audience, pages,
   frequency; confirm full-tab consistency, Undo and return to the same map.
   Exercise destination selection, unavailable/empty states, and shared setup
   dialog Cancel without changing live provider settings.
4. Inspect selected answer paths, fallback and hidden paths: priority changes,
   destination changes, insertion, bypass review, Cancel and Undo.
5. Test the explicit ordered-to-graph upgrade on a disposable legacy draft:
   Cancel unchanged, preserved visitor paths after upgrade, and full Undo.
6. Check 320/390px widths, desktop 200% zoom, long labels, keyboard traversal,
   nested modal Escape and focus return. Fix issues discovered, rather than
   relabeling them intentional differences.
7. Save/reload only QA drafts; restore their starting data. Confirm that the local
   plugin and draft PR contain the same revision. Do not publish or merge.

## Completion rule

Close acceptance rows only against named evidence from the final revision.
Passing suites establish regression coverage; browser interaction establishes the
actual experience. Keep the original goal unfinished while these checks or
resulting fixes remain. VoiceOver remains explicitly deferred and GitHub CI waived.
