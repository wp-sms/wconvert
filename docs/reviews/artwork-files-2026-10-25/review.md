# Bundled photos stored once, as files (ADR 0172)

Every Free and Pro bundled photo was re-saved by `tools/design-library/build/extract-artwork.mjs`
(`cwebp -m 6` at the same pixel size: a photo at `-q 75`; a PNG drawing lossless or at `-q 90`, whichever is smaller,
because its smooth gradients banded at 75; a WebP kept as it was where re-encoding would not shrink it). 57 photos went from 3,998,953 to 1,943,592 bytes.

New bytes give every setup that shows one a new revision, so 59 approvals went stale. Each was approved
and current on `main` (2bdd7984), and its entry differs from `main`'s **only** in its pictures (every data URI
masked, the rest of the entry is identical).

## The check

178 screens — every step and result variant of each setup, at 1200 and 375 px, with the close control, a
refused field and the countdown drawn — rendered by one renderer from `main`'s designs and from this branch's.

- No screen changed size.
- Worst mean difference: 1.76 / 255 (`everyday-almost-somewhere-1200-1`); largest single-pixel channel delta: 40.
- Each setup's most-changed 240×180 region, compared at 2× by eye: indistinguishable (compression texture only).
- At native size, before and after are indistinguishable.
- Each of the 57 photos, old bytes beside new, at 2× over its most-changed region: indistinguishable. The two
  PNG drawings first encoded at q75 showed banding at 2×; re-encoded lossless/q90, they differ from `main` by a
  mean of 0.07 and 0.00.

`metrics.json` holds every screen's numbers. The before/after pictures and crops are on the review page
published with the pull request. Their approvals are carried, not re-decided: what a visitor sees did not change.
