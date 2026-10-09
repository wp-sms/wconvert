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
passed. The second browser pass below supersedes the startup blockage recorded
in the crash-recovery history.

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

## Second browser pass — concrete gaps found and fixed

The browser connection recovered. The built plugin was inspected in Chrome at
1512 × 806 against B's interests scenario, then in the in-app browser at 390 × 844
and 320 × 740. Chrome's viewport override returned successfully but did not resize
the page; its dimensions were checked before switching to the in-app browser.
All temporary viewport overrides were reset.

| Gap found in the running plugin | Change |
| --- | --- |
| Display selector and opening editor overlapped in the narrow sidebar | Constrain all compact display-grid children to its single column. |
| Fixed Delete/Edit design footer and deletion explanation consumed form space | Put Edit design in the scrolling content and destructive controls under Screen options, available from Content and Next screen. |
| Question copy was squeezed into one line; choices had weak hierarchy | Two-line question input, numbered choices, later optional help, explicit multi-answer semantics and an explanation when referenced rules prevent answer-type changes. |
| Selecting a grouped follow-up left its actual card hidden | Reveal the selected member automatically while preserving manual grouping until the selection changes. |
| Next screen did not directly offer both forms of conditional behavior | Add conditional follow-up and Add branch open the common chooser in the correct mode. Branch context identifies the new branch and the unchanged fallback. |
| Add screen remained 512px wide despite its intended width | Correct the important utility-layer override, use a stable 700px dialog and compact desktop grids, and stack narrow layouts. |
| Newly added message screens had no message body | Include editable body copy in new messages and endings. Existing screen content is preserved. |
| Capture panel lacked a field overview and destination handoff | Show actual fields with required/optional status and open real destination settings from the save context. |
| Screen preview's desktop mode was also constrained to 512px | Correct its utility-layer override to 900px; desktop and mobile previews now have visibly distinct widths. |
| Switching to Design and back discarded Journey inspection state | Keep the visited Journey workspace in React Activity, preserving state while suspending inactive effects. Avoid loading it before the first visit. |
| Result choices appeared above a separate form, pushing the active result below the fold | Use B's expandable result cards. Copy opens under its summary; priority actions follow content and conditions. Reordering retains the opened result, including the initially opened result. |

### Browser evidence

- **Questions and grouped follow-ups:** selecting Garden details expands its map
  group. Edited question copy appears on the card and Undo restores it. Changing
  selection resets the inspector scroll to the top. Closing a deletion review
  leaves the draft unchanged and returns focus to Delete screen inside the still
  open Screen options.
- **Add and paths:** inserted a conditional Garden advice message, inspected its
  show/hidden continuation, then undid it. Added an exclusive Garden guide branch,
  confirmed its message field and existing fallback continuation, edited its body,
  and visually confirmed the text in Preview. Undid both edits. Existing contact
  selection opens Contact details with Save draft still disabled. Ending insertion
  identifies the newly unreachable ending before applying; Cancel leaves Draft.
- **Capture and destinations:** adding the optional name updates the draft. The
  capture handoff opens real destination settings. Selecting MailPoet Newsletter
  is reflected in the full Destinations tab and can be undone. Shared destination
  setup states its live scope; Cancel returns focus to Settings. No shared
  destination was saved and no provider request was sent.
- **Display settings:** exercised opening mode, Pages/Selected pages, the nested
  Add pages chooser, Specific visitors and repeat frequency. Escape closes the
  nested rule chooser. Undo restores the prior settings. A seven-day frequency
  was saved only to the QA quiz draft, verified after reload, then restored to its
  original once-per-tab behavior and saved again.
- **Results:** switched between sunny-garden and balcony result copy; edited and
  undid a heading. Design receives the selected result screen. Changed result
  access from required capture to immediate result/optional signup and restored
  it with one Undo. Catalog search reports a recoverable load error on this local
  installation; successful live catalog selection is not established here.
  After the final build, expanded result cards were visually inspected on desktop
  and at 390px. Enter collapses the first result, Tab reaches the next summary,
  and Enter opens its form. A Design round trip retains Balcony picks, expanded
  Screen options and the exact map transform.
- **Combined-enquiry simulation:** Garden and Balcony both reach their follow-ups.
  Going Back and removing Garden skips it while retaining Balcony's Second option.
  The journey reaches one contact checkpoint, skips Indoor, retains the test email
  after a simulated failure, and reaches Request received on retry. The checkpoint
  reports Accepted in test; no real Lead or delivery is created.
- **Legacy transition:** on Reveal a welcome discount, upgrade Cancel leaves Save
  draft disabled. Enabling flexible paths changes only the in-memory draft; Cancel
  closes Add and Undo restores Ordered screen actions with Save disabled. Reload
  discards temporary history. This campaign was never saved or published.
- **Narrow layout:** the 390px selected question has no document horizontal
  overflow. At 320px the chooser fits the viewport, its content scrolls and its
  action footer remains reachable. Escape returns focus to Add screen. Desktop
  and mobile screen-preview widths were visually checked after the CSS fix.

### Acceptance still open

Keep the original goal and PR open. Do not infer full experience parity from the
regression suite or from this list of exercised paths. Remaining checks are:

1. Native 200% browser zoom and the complete keyboard-only route through every
   nested editor; the tested narrow CSS viewports are not a substitute for zoom.
2. Successful live WooCommerce product selection and unavailable-product handling
   with a working catalog. The current local browser test covers the error state.
3. An occasional-merchant usability session for first-time understanding; none
   has been conducted. VoiceOver remains explicitly deferred, not passed.

### Local regression and packaging evidence for this pass

- Full local JS suite: **168 files / 3,091 tests**, one worker.
- Final focused inspector, repair and builder regression pass: **120 tests**.
- TypeScript and ESLint pass; Free/Pro admin builds pass.
- Free/Basic/Pro/Elite packaging and all artifact contracts pass.
- No PHP or visitor-loader source changed. GitHub CI was not run.
- Work remains on `codex/plan-questions-conditional-screens`, the branch behind
  draft PR #190. Built assets are available in the local plugin; reload an editor
  opened before the build so it uses the current asset manifest.

## Completion rule

Close acceptance rows only against named evidence from the final revision.
Passing suites establish regression coverage; browser interaction establishes the
actual experience. Keep the original goal unfinished while these checks or
resulting fixes remain. VoiceOver remains explicitly deferred and GitHub CI waived.
