# 0189: Links to our sites carry one scheme

Accepted 2026-11-04. Amends [ADR 0144](0144-help-is-a-page.md), [ADR 0145](0145-guides-are-linked-where-people-get-stuck.md) and [ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md).

A check of every link in Free and Pro found them all working, but tagged four different ways. The readme's tags were consistent. Pro links in Free put the surface in `utm_medium`, which made six invented mediums. Locked design cards used a scheme of their own. Every other link carried nothing, and with `rel="noreferrer"` those visits arrive with no source at all.

## Decision

**The same four questions on every link, following the readme:**

| Tag | Meaning | Values |
|---|---|---|
| `utm_source` | Where the visitor was | `wp-admin` (the readme keeps `wordpress.org`) |
| `utm_medium` | What kind of place | `plugin` (the readme keeps `plugin-directory`) |
| `utm_campaign` | Which product's link | `wconvert-free`, `wconvert-pro` |
| `utm_content` | Which spot | below |

`utm_content` is one of `header`, `settings-list`, `rule-menu`, `rule-picks`, `flow-map`, `destinations`, `campaign-menu`, `template-card`, `guide`, `help`, `help-search`, `footer`, `plugins-screen`, `admin-notice`, `inspector` or `license`. The landing page already says what the link was for, so the tags don't repeat it.

**Fixed values only.** Never the site, the version, the user or a count ([ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 5).

**The tag names the plugin that owns the link.** Free's links stay `wconvert-free` on a Pro install. Pro's own screens, its notice and its Plugins row say `wconvert-pro`.

**One way to write a link.** `taggedUrl()` and `docsUrl()` in `shell/docs.ts` and `Docs::tagged()` and `Docs::url()` in PHP are the only shipped code that writes our addresses, apart from the exempt list below. Pro's screens use `proDocsUrl()`, a thin wrapper. `tests/js/site-links.test.ts` fails on any other address, and on a link in `readme.txt` without the readme's tags.

**Tags go before a `#section`,** or the browser would never send them.

**A GET form drops any query in its `action`,** so the two Help search forms keep the bare docs address and send their tags as hidden fields.

## What stays untagged

- Plugin headers (`Plugin URI`, `Author URI`).
- wordpress.org links.
- Account and license server links on `my.wconvert.io`, including the store's `renew_url` and `upgrade_url`. They serve existing customers.
- API addresses.
- The legal and service lines in `readme.txt`.

## Consequences

- Nothing on wconvert.io reads these tags yet. Its pages have no analytics tag, and its pricing buttons drop the tags on the way to `my.wconvert.io`. That work belongs to the website's repository, and until it is done the tags are correct but unrecorded.
- **Pro now needs this Free.** Pro calls `Docs::tagged()` and reads `Docs::PRO` and `Docs::PRICING`, which Free 1.0.0 doesn't have, and `WCONVERT_MIN_CORE` still allows it. Release the Free that ships this first, then raise `WCONVERT_MIN_CORE` to that version before releasing Pro, or Pro fatals on sites still running Free 1.0.0.
- A new spot is a new word on the `LinkSpot` type, and PHP passes the same word as a plain string. `DocsTest` and `site-links.test.ts` pin the same full addresses, so the twins can't drift unnoticed.
- `readme.txt` writes `templates.wconvert.io` without `https://`, because that address is an API and returns 404 at its root.
