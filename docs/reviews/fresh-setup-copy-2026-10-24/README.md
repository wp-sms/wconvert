# Fresh setup copy investigation — 24 October 2026

**The original mixed screenshot has not been reproduced. Its exact trigger is
unresolved.** The user selected a new setup directly; there is no evidence here
that they switched an existing campaign's design. The earlier Slot Role fix
prevents a sentence being transferred into an offer amount, but is not proof
that transfer caused this fresh-setup incident.

## Actual local plugin checks

Checked the installed `wconvert.local` plugin through its normal admin UI,
against source commit `ea1eadf8` (same tree as PR head `521df282`). No product
code changed during this investigation. The local catalogue was the previously
verified 50-design release. Requests were observed with a temporary local-only
REST response hook; the hook has been removed.

| Fresh route | Created draft | Result after reload |
| --- | --- | --- |
| Promote an offer → Extra-Ten Coupon → Use this setup | `01M5QDFHJEZVEG5E4TTC5BD7TK` | Extra-Ten ID throughout; shoe artwork, ONE MORE REASON, 10%, Use my code |
| Grow my email list → Choose a design myself → Slide-in → Extra-Ten Coupon → apply sample content → Save draft | `01M5QD5QFYD9XTGCZQF0P9EZV8` | Extra-Ten ID; shoe artwork and 10% retained; email form and Get my code added |
| Grow my email list → Works with this goal → Closing time → Use this setup | `01M5QDVHP5RQWYG3FT7SPERYWB` | Closing time ID; yellow design, Goodbyes wording, 25%, email form; no shoe image |

These are three routes tested, not a claim about which route the user took.
Extra-Ten is not among the first six offers shown under Works with this goal;
Closing time is. The blank-email route's apply button says “Switch to Slide-in”
because the empty draft defaults to popup. No previous template or copy existed
in that draft.

All three review drafts were never published and were soft-deleted after capture.
No other campaigns were changed.

### Evidence

- [Direct offer creation](offer-direct-created.png)
- [Shoe design with email form, after reload](email-design-created-mobile.png)
- [Closing time with email form, after reload](email-ready-setup-created-mobile.png)
- [Sanitized local request trace](local-request-trace.jsonl): selected IDs,
  revisions, template hashes, copy and picture hashes at preview, prefill,
  create/save and reload. No credentials or visitor information recorded.
- [Read-only source/history findings](wconvert-copy-forensic-summary.json)
- [Registered prefill and blank draft checks](wconvert-fresh-path-readonly.json)
- [Repeated form conversion checks](wconvert-fresh-conversion-sequence.json)

Trace caveat: the first `/templates/snapshot` response used a direct tree shape
that the temporary summarizer did not yet recognize. Its empty output summary
is missing instrumentation, **not an empty server response**. The subsequent
PATCH and reloaded GET include the correct full tree summary. Template hashes
can change at normalization; identity, text and picture hashes are compared
separately. The direct setup route never requested a Closing-time-to-Extra-Ten
snapshot transfer.
The blank email draft was created before tracing began: that route's trace
starts at design preparation and covers save/reload, while the initial blank
creation was observed in the UI. The trace alone does not cover its entire route.

Historical source versions `d7688edf`, `dc915bdc` and current source pair the
correct Playbooks and Templates. The saved local snapshots did not contain the
reported hybrid. A transient preview state would not necessarily be saved, so
this does not disprove the screenshot or establish its cause.

## Changes and limits

Added a GoalScreen regression test that inspects Closing time without creating
it, selects Extra-Ten, then receives Closing time's preview late. It verifies the
selected setup's ID, revision, prepared revision and exact creation payload,
using mocked API responses and native source trees.
This covers expected behavior; it is not a red-to-green reproduction of the
reported incident. The focused GoalScreen/other-side/preview tests passed (60
tests), and the changed test passed ESLint.

Preflight validation: all checks passed. The first run caught a TypeScript
return-type error in the new test's cleanup callback; after fixing it, the
checks from TypeScript onward were rerun. The earlier source/loader/admin,
3,872 PHP tests and PHPStan checks remained unchanged and passed. The resumed
checks passed 5,437 JavaScript tests, lint, converted designs, builds, POT
coverage, design library/studio, catalogue revisions/approvals and worker checks.

No speculative runtime fix or additional editor setting was introduced. To
establish the historical trigger we still need a request/state capture from an
occurrence of the mixed preview; current successful requests cannot supply it.

## Small improvement for future templates

The existing design-a-template checklist now finishes in the real plugin's
new-campaign picker: select → create unpublished → save → reload → inspect
desktop and phone, including the added-form variant. Compare identity, wording,
offer amount and artwork with the approved reference and keep screenshots with
the source revision. Repeat after the final template or renderer edit.

Use the existing Design Bench and shipping blocks/fonts for prototypes where
possible. Record any intentional editor limitation at review time. This extends
the existing review rather than adding another editor feature, framework or
approval dashboard.
