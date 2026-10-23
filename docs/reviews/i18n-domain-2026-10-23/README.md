# Collections re-approved after the Pro text-domain change — 2026-10-23

PR #337 moved every gettext call under `pro/` from `'wconvert'` to
`'wconvert-pro'` (ADR 0165). Pro's playbooks changed bytes with it, and a
collection pins each setup by the sha256 of its playbook file, so eight
collections went stale with nothing a visitor sees changed:

sale-planning, black-friday-2026, help-shoppers-choose, prepare-a-visit,
useful-store-details, halloween-2026, black-friday-cyber-monday-2026,
christmas-new-year-2026.

## What was checked

`manifest.json` lists all 58 re-hashed collection items. For each, the playbook
on `main` and on this branch were read and compared after two normalisations,
replacing `'wconvert-pro'` with `'wconvert'` and dropping inline
`/* translators: … */` comments. Every pair is identical, and every item's
`design_hash` is unchanged. So the words, rules, design and screens of every
member are exactly what was approved before.

Setup approvals did not move either. Rendered identity hashes the rendered
markup (ADR 0156), and `templates:releasable` reported only these eight
collections as stale.

## Decision

Approved again by Navid Kashani on 2026-10-23, in the session that made the
change: "they are good to go". No item, order, word or screen changed.
