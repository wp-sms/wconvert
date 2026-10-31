# 0175: The online library loads without asking

Accepted 2026-10-30. Amends [0156](0156-the-catalogue-is-one-design-per-object.md)
§8 and §14, [0171](0171-one-template-gallery.md) §9 and its `online` /
`library` fields, and [0127](0127-free-keeps-product-seams-not-product-reads.md)'s
note on the hosted library.

## Context

Since 0156 the template gallery ended in a one-time card — "See more templates
from the WConvert library?" — and nothing reached `templates.wconvert.io` until
an admin answered yes. A fresh site therefore showed only its bundled templates,
and the online library, most of the gallery, sat behind a question most admins
skipped past.

wp.org Guideline 7 forbids contacting outside servers without consent, but
exempts a plugin acting as the interface to its own service. The template
library is exactly that: WConvert's designs, served from WConvert's host, fetched
when an admin opens WConvert's gallery to choose one. Template-library plugins
on wp.org fetch the same way and disclose it under the readme's "External
services".

## Decision

**1. The library is on by default.** The option
`wconvert_template_library_consent` keeps its `'yes'|'no'` values, and
`'unanswered'` is gone: anything other than `'no'` reads as `'yes'`. With no
`checked_at`, the cache counts as stale, so the first gallery open — step 2 or
Change template — runs the existing `refresh(if_stale)` and fetches. No new code
path fetches.

**2. There is no consent card.** The gallery's last-page card and the pinned
design's "allow first" state are deleted. A `?design=` link to a design only
online resolves to `install` after that same stale refresh.

**3. What stays.**
- The off switch in Settings → Data & privacy, with the disclosure text beside
  it. Saying no there blocks every request and hides the cached index at once.
- `WCONVERT_TEMPLATE_CATALOG` and the `wconvert_template_catalog` filter, which
  switch the library off entirely.
- Nothing is fetched on activation, from cron, on the dashboard or on the front
  end — only inside an admin request that opened a gallery or followed a
  `?design=` link, at most every twelve hours.
- `POST /template-catalog/consent`, which the Settings switch uses.

**4. Disclosure moves to Settings and the readme.** What is sent and to whom —
designs and thumbnails from `templates.wconvert.io` on Cloudflare, the admin's
IP address seen by Cloudflare, no site, licence or visitor data — is said in the
Settings hint and in readme.txt's External services, which now says the library
is on and how to turn it off.

## Consequences

A fresh site's gallery shows online templates on first open. The asking flow's
tests now assert the default-on behaviour; the journey tests' `consent` is the
visitor's checkbox, a different thing, and is untouched.
