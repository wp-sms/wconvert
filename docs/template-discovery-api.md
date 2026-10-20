# Template catalogue v3 — wire contract

Implements [ADR 0156](adr/0156-the-catalogue-is-one-design-per-object.md). The
plugin reader is `src/Template/Catalog/` (`CatalogIndex`, `DesignObject`,
`DesignArchive`, `TemplateCatalog`); the publisher is
`tools/design-library/build/publisher.mjs`; the service is
`tools/template-server`. This file is the contract between them. A v1 plugin
reads it for as long as it is installed, so **everything below is additive
within major 3**.

## Rules every reader follows

- **The major version is in the address.** The pointer lives at
  `<origin>/v3/manifest.json`. A v4 service sits beside it at `/v4/`; the v3
  pointer may then say `"latest_major": 4`, and a v3 reader shows "Update
  WConvert to see new designs" while it keeps working.
- **`minor` may be higher than the reader knows.** It is read anyway.
- **Unknown keys are dropped** in the pointer, the release, index entries,
  design and setup envelopes, and `meta`. **Unknown keys are refused** inside
  `tree`, `tokens`, `assets`, `image_bindings` and a setup's `playbook`: that
  is the security boundary of ADR 0082.
- **An unknown `tier`, `format`, capability or a `requires.plugin` above the
  reader's version means "Update WConvert"**, never "free".
- **A failure costs one entry.** Page bytes are verified as a whole; an
  unreadable entry inside verified bytes is skipped and counted.
- **Ids are never reused.** A rename keeps the old id in the new entry's
  `aliases`. Revisions are integers and only increase.

## Objects

Every object other than the pointer is immutable and content-addressed: its
path contains the SHA-256 of its exact bytes, served `immutable` for a year.

| Path under `/v3/` | Bucket | What |
| --- | --- | --- |
| `manifest.json` | public | The pointer. The only mutable object. `no-cache`, with an ETag. |
| `releases/<sha>.json` | public | A release: page list, taxonomy, collections, sidecars. |
| `index/<sha>.json` | public | A page of entries, a detail page, an i18n sidecar or the popularity sidecar. |
| `designs/<sha>.json` | public | A Free design object. |
| `setups/<sha>.json` | public | A Free setup object. |
| `assets/<sha>.<png\|jpg\|webp>` | public | A Free image. |
| `thumbs/<sha>.webp`, `thumbs/<sha>@2x.webp` | public | A card thumbnail, 1× and 2×. |
| `og/<sha>.jpg` | public | The website's Open Graph image. |
| `previews/<sha>.html` | public | An inert, sandboxed HTML preview for the website. |
| `premium/designs/<sha>.json` | private | A premium design object. Grant required. |
| `premium/setups/<sha>.json` | private | A premium setup object. Grant required. |
| `premium/assets/<sha>.<ext>` | private | A premium image. Grant required. |
| `grants` (POST) | — | Issue a five-minute pass for a batch. |

In private storage the `premium/` prefix is dropped: `premium/designs/<sha>.json`
is stored as `v3/designs/<sha>.json` in the private bucket.

Size caps the reader enforces: pointer 64 KiB; release, page, design and setup
256 KiB each; at most 16 pages, **1 MiB of pages in total**; images 5 MiB each,
20 MiB per design. A design entry is about 430 bytes (three 64-character digests
are most of it), so the 1 MiB budget holds about 2,400 designs; the publisher
proves 2,000 in `publisher.test.mjs`. A reader keeps the pages that fit its
budget and drops the rest with "Update WConvert to see new designs", so list
pages oldest-first: a library that outgrows an old reader costs it the newest
designs, never the ones it already showed.

### Pointer — `v3/manifest.json`

```json
{
  "schema": 3, "minor": 0,
  "release": "<sha of releases/<sha>.json>",
  "withdrawn": [{"id": "old-design", "revision": 2, "reason": "rights"}],
  "popularity": "<sha of an index/ object>",
  "latest_major": 3
}
```

`withdrawn` is mutable on purpose: it can change without a release. A row
without `revision` withdraws every revision. `reason` is `rights`, `quality`,
`broken` or `other` (anything else reads as `other`). A withdrawn design leaves
the picker; an Optin already using it keeps its copy and gets a notice.
Nothing is ever deleted from a site remotely.

### Release — `v3/releases/<sha>.json`

```json
{
  "schema": 3, "minor": 0,
  "pages": ["<sha>", "..."],
  "details": ["<sha>", "..."],
  "i18n": {"de_DE": "<sha>"},
  "taxonomy": {
    "industry": [{"id": "food", "label": "Food & drink"}],
    "occasion": [{"id": "christmas", "label": "Christmas"}],
    "style": [{"id": "minimal", "label": "Minimal"}],
    "colour": [{"id": "warm", "label": "Warm"}]
  },
  "collections": [{
    "id": "sale-planning", "revision": "<64 hex>", "name": "…", "description": "…",
    "cover": "sale", "priority": 10, "business_types": ["stores"], "markets": ["GB"],
    "items": [{"setup": "welcome-discount", "stage": "before"}, {"design": "reading-slip", "stage": "any"}],
    "event": {"family": "black-friday", "start": "2026-11-27", "end_exclusive": "2026-11-28",
              "feature_start": "2026-10-16", "feature_end_exclusive": "2026-11-28"}
  }]
}
```

The taxonomy's labels live here, not in the plugin, so adding an industry
needs no plugin release. `details` pages are for the website; the plugin does
not read them.

### Index page — `v3/index/<sha>.json`

```json
{
  "schema": 3,
  "designs": [{
    "id": "reading-slip", "revision": 3, "sha256": "<design object>", "bytes": 9123,
    "name": "Reading slip", "format": "popup", "tier": "free",
    "family": "reading", "aliases": ["reading-card"], "slug": "reading-slip-card",
    "requires": {"plugin": "1.0.0"},
    "prerequisites": ["woocommerce"],
    "tags": ["industry:books-publishing", "occasion:evergreen", "style:editorial", "colour:warm"],
    "facets": {"act": "submit", "captures": ["email"], "shape": "stack"},
    "thumb": "<sha>"
  }],
  "setups": [{
    "id": "welcome-discount", "revision": 1, "sha256": "<setup object>", "bytes": 2048,
    "name": "Welcome discount", "goal": "grow_email_list", "tier": "free",
    "design": {"id": "reading-slip", "revision": 3},
    "requires": {"plugin": "1.0.0", "capabilities": ["campaign-starts:1"]}
  }]
}
```

- `facets` are DERIVED by the publisher with the shipping `TemplateFacets`
  (ADR 0043), so a card with no tree can still be filtered by Goal.
- `prerequisites` names other plugins only, never a WConvert module or plan.
  A missing one reads "unavailable", which outranks "locked".
- `requires.plugin` is computed from the newest `since` stamp the design uses
  (`resources/templates/since.json`). An entry may also list `capabilities`;
  the publisher leaves them out, because a new capability always raises the
  plugin version, and the design object declares exactly what it uses.
- Defaults are omitted to keep entries small: `slug` defaults to `id`, and a
  facet that is false, null or empty is left out.

A detail page (website only) is `{"schema": 3, "details": [{"id", "slug",
"description", "industries", "occasions", "style", "colour", "screens",
"preview": "<sha>", "og": "<sha>", "thumb": {"sha", "width", "height", "alt"}}]}`.

The popularity sidecar is `{"schema": 3, "generated": "2026-10-20", "downloads": {"<design id>": 120}}`.
An i18n sidecar is `{"schema": 3, "designs": {"<id>": {"name", "description"}}}`.

### Design object — `v3/designs/<sha>.json`

```json
{
  "schema": 3, "minor": 0,
  "id": "reading-slip", "revision": 3, "name": "Reading slip",
  "display_type": "popup", "tier": "free", "family": "reading",
  "meta": {"description": "…", "slug": "reading-slip", "industries": ["books"], "occasions": [], "style": ["editorial"], "colour": ["warm"]},
  "requires": {"plugin": "1.0.0", "tree": 2, "capabilities": ["capture-journey:1", "template-tree:2"]},
  "assets": [{"id": "image-…", "sha256": "…", "mime": "image/png", "bytes": 1234, "width": 800, "height": 600, "access": "free"}],
  "image_bindings": [{"node_id": "n7", "asset_id": "image-…"}],
  "tree": {"v": 2, "steps": []},
  "tokens": {}
}
```

Free designs may bind only `access: free` images. Authored links and picture
URLs are empty; the merchant supplies them after installing.

### Setup object — `v3/setups/<sha>.json`

```json
{
  "schema": 3, "minor": 0,
  "id": "welcome-discount", "revision": 1, "name": "Welcome discount", "tier": "free",
  "design": {"id": "reading-slip", "revision": 3},
  "requires": {"plugin": "1.0.0", "capabilities": ["campaign-starts:1"]},
  "playbook": {"goal": "grow_email_list", "copy": {}, "rules": [], "notes": "", "business_types": ["stores"], "destination_hint": null}
}
```

A setup pins one design revision. Its tier is the highest of design, rules,
Goal and format. Installing a setup installs its pinned design and images too.

## Premium grants — `POST /v3/grants`

```http
POST /v3/grants
Content-Type: application/json
X-License-Key: <SDK key>

{"domain": "example.com", "designs": ["<sha>", "…"], "setups": ["<sha>"]}
```

At most 50 digests in total, each one a premium object in the current or a
retained release. The Worker builds the file list — each object plus every
asset its design binds — asks Nexus for a grant over the digest of that list,
verifies it and answers `{"grant": "<JWT>", "expires_in": 300}`. Every file in
the batch is then fetched with `Authorization: Bearer <grant>`. Refusal codes
are unchanged from v2 (`invalid_key`, `license_expired`, `domain_not_allowed`,
`invalid_grant`, `resource_not_allowed`, `rate_limited`, …).

Only the plugin sends credentials, only to its pinned origin, and only on an
explicit premium install or preview.

## Counting

The Worker writes one Analytics Engine data point for every design-object GET
(`designs/` or `premium/designs/`) whose user agent starts `WConvert template`,
before any storage or cache lookup: blob1 = the design object's digest, blob2
= `free` or `premium`, double1 = 1. No IP, domain, licence or other identifier
is written. `scripts/popularity.mjs` sums `_sample_interval` per digest, maps
digests to ids through the live index, and publishes the popularity sidecar.

## Privacy

Public requests carry no licence, site address, campaign or lead data; the
fixed user agent is `WConvert template catalog`. Thumbnails are loaded by the
administrator's browser with `referrerpolicy="no-referrer"`, so Cloudflare sees
that browser's IP address. Pro's grant request sends the licence key and the
site's domain to the pinned origin, which passes them to Nexus.
