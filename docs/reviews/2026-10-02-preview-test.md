# Preview & test implementation — 2 October 2026

The user approved concept A after comparing three interactive prototypes. The production modal now opens directly on “Try as a visitor”, with separate “Check the design” and “Explore answer paths” tasks. The temporary comparison code and npm command were removed. The original concept screenshot and reasoning remain in `tools/design-system/editor-prototype/preview-test-prototype/`.

The preview keeps the production renderer, rule evaluators, accepted snapshots, failure recovery, phone handling, changed-screen suggestions and map highlighting. Context now develops with the test: a visited timeline, disclosed path explanations and other screens, submission details after submit/skip, and failure controls at a pending submission. Desktop/mobile width changes resize the same form. Unsent answers remain when changing modes. Reaching an acknowledgement counts once per run; restarting clears that run's sample data while retaining the session count. Session state ends when the modal closes.

Design mode provides named screen selection, inactive layout preview, desktop/mobile widths and result variants. Answer exploration starts unanswered and pauses at a question or explicit submit/skip choice. It highlights only the predicted prefix and does not count as a visitor test. Changing an earlier choice drops later choices that are no longer on the predicted prefix. Simple forms omit this mode.

Verification:

- 115 tests across nine focused suites passed: journey editor, interactive tests, phone retention, sample paths, progress, product simulation, editor simplification, builder preview and changed-screen suggestions.
- New regressions cover unsent input retention across mode switches, resizing without remounting, counting a run once when returning to its ending, no implicit fallback route, explicit optional-answer omission, clearing old branch answers, and deliberate submission choices.
- TypeScript and targeted ESLint checks passed.
- Free and Pro admin bundles rebuilt successfully. Vite reported its existing mixed static/dynamic import and large-chunk advisories.
- WordPress browser walkthrough: DEMO 04 home → indoor plants → text detail → enquiry. Switched to design and back with an unsent choice; the selected choice persisted. Simulated a failed save, retried successfully, and saw one accepted test submission and one completed run.
- At 390 × 844, the dialog fits without horizontal overflow (client and scroll width both 372px), the form remains usable, and footer actions remain visible. Checked the unanswered prediction view at this width as well.

Follow-up browser verification:

- DEMO 01 simple newsletter: required email validation focuses the missing field; fictional email and consent reach acknowledgement with one accepted submission. Submitted details match the input. Answer exploration is omitted.
- DEMO 02 email then optional SMS: accepted email persists when SMS is skipped. Returning to SMS and submitting a fictional number replaces the skipped status with an accepted submission while retaining one completed run.
- DEMO 05 coffee quiz: espresso and chocolate answers show the expected result, skip the irrelevant grinder question, and allow declining optional email before the ending.
- The existing coffee product-simulation QA campaign shows available, unavailable and loading-error states. Retry restores the available simulation and moves focus to its status. No live catalog request is needed.
- Keyboard checks: Tab reaches the visitor form from initial focus; changing modes keeps focus on the selected mode and subsequent Tab enters visible controls; Tab and Shift+Tab wrap inside the modal; Escape and Back to editor restore trigger focus; Edit this screen opens the correct editor section and focuses its heading.
- DEMO 04 with all four home interests visits eight screens in order, including each follow-up, and accepts one combined enquiry containing all answers. Long timeline and submission details scroll independently of the desktop preview; phone footer controls stay reachable.
- This longer run exposed cramped side-by-side submitted labels and values. The sidebar now stacks each label above its value at every width. Rebuilt both bundles and verified the fix at 1280 × 900 and 390 × 844. The phone dialog still has equal client and scroll widths of 372px. Evidence: `2026-10-02-preview-test-submission.jpg`.
- No browser console errors were captured. Campaign Save draft remained disabled after testing. The editor is left with a fresh preview session open.

All browser submissions were simulations using fictional contact details. No campaign was saved or published. This work does not verify website targeting, real destination delivery, live catalog stock/prices, or every possible campaign path.
