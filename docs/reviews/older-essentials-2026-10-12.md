# Older essentials — 12 October 2026

This batch revises two existing designs and reviews all four studio setups that use them. It adds no designs or campaign setups: the source library remains 107 designs / 153 registered setups; the studio remains 128 setups / 75 designs.

## Changes and practical purpose

- **Project notebook** — the split ratio was a string and the renderer ignored it. Use the supported numeric ratio, giving the cover less room and the form more. The cover heading now handles both a short number and the longer “Before the visit” use case without a giant text block. Compact phone spacing, readable 14px fine print, a stronger field border, softer shadow and the amber acknowledgement strip make the whole journey consistent. Stable content/field IDs and submission references remain intact; an unneeded divider was removed.
- **Bar with a field** — group the email/action together beside the message. When width is insufficient, the action wraps with its form rather than stranding under the announcement. Consent remains visible and legible below, and the confirmation groups its heading and explanation consistently. The decorative tick is removed. This remains a Basic floating bar, not a modal or a new campaign type.

Setups: `project-planning-guide`, `project-readiness-guide`, `repair-workshop-news`, `local-class-news`. They appear in `pilot.html?batch=older-essentials`.

## Review and evidence

Inspected every final input and acknowledgement screen at desktop and 320px in the proof screenshots. The native phone popup fits a 740px viewport, the email focus outline remains visible and the compact bar retains a separate close action. Template palettes remain amber/brown and blue/white; the internal studio theme does not recolour them.

- [Responsive audit](older-essentials-2026-10-12-audit.json): 128 rendered cases (four setups × two screens × four widths × two directions × normal/long copy), zero overflow, control-size, input-size, text-contrast or field-outline findings. The audit labels entries “designs”; these are four filled setups using two designs. A long-copy cover overflow found during iteration was fixed before this report.
- [Studio journeys](older-essentials-2026-10-12-journeys.json): all four test required input, simulated failure/retry with preserved state, and acknowledgement.
- [Native WordPress journeys](older-essentials-2026-10-12-live.json): eight runs, each with required-email rejection, actual `primary` capture returning a saved Lead ID, and acknowledgement on desktop/phone. The disposable fixture uses Collect only; no email or SMS was sent. The first attempt with a single-worker Playground became unreliable during overlapping requests; the final run used six workers and waited for the actual submission response, not its preliminary grant.
- Proof screenshots: [planning guide](older-essentials-project-planning-guide.png), [visit checklist](older-essentials-project-readiness-guide.png), [workshop news](older-essentials-repair-workshop-news.png), [class news](older-essentials-local-class-news.png). Native screenshots cover both states at both widths for every setup (`older-live-*.png`).

Native captures verify request acceptance only. Merchants still supply the promised resource and delivery destination for guides, and actual event dates/booking details for later announcements. No automatic subscription, booked appointment or delivered email is claimed. Existing merchant campaigns retain their saved snapshots.

The shared studio journey runner now accepts an optional batch and evidence path so this review uses the existing interaction logic. Reproduce:

```sh
bash tools/design-library/build.sh renderer pilot proof roadmap
node tools/design-library/build/batch-audit.mjs older-essentials
node tools/visual-tests/older-essentials-visual.mjs
node tools/visual-tests/template-studio-refresh.mjs older-essentials docs/reviews/older-essentials-2026-10-12-journeys.json
node tools/visual-tests/older-essentials.mjs
```

Serve the studio on 9452 and the guarded disposable WordPress harness on 9453. Never mount the MU fixture on a saved merchant site. Editorial approval covers these four exact revisions only; it does not approve the other older setups or add them to the hosted release.
