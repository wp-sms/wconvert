# Ad-block plan audit

Reviewed 2026-09-29 against [the plan](../plans/ad-blocking/implementation.md)
and [draft PR #193](https://github.com/wp-sms/wconvert/pull/193).

The core rule, bounded probe, authoring control, inspector diagnostics and
beacon fallback are implemented. The plan as a whole is **not complete**, so
this review does not recommend merging the draft PR yet.

| Plan slice | Finding |
| --- | --- |
| 1 — reproducible baseline | Incomplete. Bundle sizes and a WordPress boot smoke were recorded, but no signed-out Campaign fixtures, actual blocker/filter-list matrix, capture and counter deltas, or sanitized baseline report were collected. Without those observations there is no evidence for a delivery-path alias. |
| 2 — Free diagnostics | Implemented in source, including a bounded wait and manual loader recheck, but blocked-loader and optimizer outcomes have not been demonstrated on a real WordPress page. The empty beacon REST batch did return 204 without adding a stats row in Playground. |
| 3 — Pro audience rule | Implemented in source. The probe passed clean and synthetic CSS-hiding checks in Chromium, Firefox and WebKit; this does not establish behavior with real extensions. The draft/save/publish/Undo/Redo and popup/inline/paid presentation path has not been exercised end to end on WordPress with clean and blocked profiles. |
| 4 — release qualification | Incomplete. The extension, Safari/iOS content blocker, DNS-only, optimizer, CSP, storage-denial, accessibility and full-loader-block comparisons are not recorded. The plan explicitly requires the CI aggregate check to be green before merge. |

Source-level tests cover the detector's clear, hidden, mixed and interrupted
measurements; its cleanup; enum validation; the inspector's reported states;
and beacon fallback. The additional inspector audit covers 204, 429, 403,
404, 503, rejected requests and timeout. Tier-specific bundles and staged
artifacts passed locally. Those checks cannot replace the browser and
WordPress acceptance matrix above.

The [PR's CI run](https://github.com/wp-sms/wconvert/actions/runs/36515939766)
did not execute any job steps. GitHub's check annotation says the jobs were
not started because recent account payments failed or the Actions spending
limit needs increasing. The required `CI / Required checks` result is failed,
irrespective of passing local checks. Resolve the account limit and rerun the
PR workflow before considering merge.

The conditional delivery compatibility mode remains out of scope until a
specific blocking filter and a successful alternative path are measured, as
the plan requires.
