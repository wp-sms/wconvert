# Public gallery contract, catalogue v3

The website's gallery reads the same catalogue v3 the plugin reads, from the
same origin. The wire contract is
[`docs/template-discovery-api.md`](../../docs/template-discovery-api.md); this
file is the part of it the website uses, plus what the service and the operator
scripts enforce. Nothing here grants installation rights.

v3 has **no `designs.json`**, no `Link: rel="describedby"` header and no
full-pack or focused viewers. The website reads the release's **detail pages**,
each detail's **preview**, its **Open Graph image** under `og/`, and its
thumbnail. See [Migration from v2](#migration-from-v2) for the routes that stay
up until the website moves.

## Discover one consistent release

1. At website build time, fetch `https://templates.wconvert.io/v3/manifest.json`
   (the **pointer**). Require `schema: 3`. Read `release`, `withdrawn` and the
   optional `popularity` and `latest_major`. Ignore unknown keys; `minor` may be
   higher than you know.
2. Fetch `/v3/releases/<release>.json`. Its SHA-256 must equal `<release>`.
3. Fetch every digest in its `details` array from `/v3/index/<sha>.json`, and
   check each page's SHA-256 against its name. If the build also needs tiers,
   formats or tags, read the `pages` array the same way: those are the plugin's
   index pages.
4. Use that snapshot for the whole build. Do not refetch the pointer per design.

Every object except the pointer is immutable and named after the SHA-256 of its
exact bytes, so a verified object never needs revalidating. The single
exception is the 2× thumbnail (below). Never silently replace a previously
successful gallery with an empty one after a fetch or validation failure.

## Detail pages

```json
{
  "schema": 3,
  "details": [{
    "id": "reading-slip",
    "slug": "reading-slip",
    "description": "…",
    "industries": ["books"], "occasions": [], "style": ["editorial"], "colour": ["warm"],
    "screens": [],
    "preview": "<sha of previews/<sha>.html>",
    "og": "<sha of og/<sha>.jpg>",
    "thumb": { "sha": "<sha of thumbs/<sha>.webp>", "width": 896, "height": 376, "alt": "…" }
  }]
}
```

- `id` is the authored design id. Ids are never reused; a rename keeps the old
  id in the index entry's `aliases`. Key editorial choices on `id`, and use
  `slug` for the website's URL.
- The taxonomy ids (`industries`, `occasions`, `style`, `colour`) are labelled by
  the release's `taxonomy` object, not by the website or the plugin.
- `screens` lists the design's screens as the publisher writes them.
- `preview`, `og` and `thumb` are optional. A detail without them still has its
  words; show no iframe or broken image for a missing one.
- An id appears at most once across all of a release's detail pages.

The operator scripts (`scripts/design-catalogue.mjs`) refuse a release whose
detail pages break any of the above, or whose `preview`, `og` or `thumb` objects
are missing or do not match their digests.

## Files the website loads

| URL under `https://templates.wconvert.io` | Type | Notes |
| --- | --- | --- |
| `/v3/previews/<preview>.html` | `text/html` | Sandboxed preview, embedded in an iframe. |
| `/v3/og/<og>.jpg` | `image/jpeg` | The design's Open Graph image. |
| `/v3/thumbs/<thumb.sha>.webp` | `image/webp` | 1× card thumbnail; `width`/`height` are its decoded size. |
| `/v3/thumbs/<thumb.sha>@2x.webp` | `image/webp` | 2× card thumbnail. |

The 2× file is named after the **1× digest**; its own digest is not in its name
or in any catalogue object. Fetch it by that name and trust the service's HTTPS,
as for any image you do not hash. The operator tools check it exists and fits
the image budget, and backups record its actual digest.

Load thumbnails with `referrerpolicy="no-referrer"`. Use `object-fit: contain`
when a card's aspect ratio differs from `width`/`height`.

## Previews

Embed a preview in an iframe with `sandbox="allow-scripts"` and
`referrerpolicy="no-referrer"`. The service sends:

```text
Content-Security-Policy: sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline';
  style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none';
  frame-ancestors <PREVIEW_EMBED_ORIGINS>
```

No same-origin, form, popup or top-navigation permission; no network; images
and fonts are data URLs. A preview is a demonstration, not editable source.
Premium previews show a Pro design's appearance without its installation
payload.

`PREVIEW_EMBED_ORIGINS` is set per environment in `wrangler.jsonc`: production
allows `https://wconvert.io`, `https://www.wconvert.io` and
`https://dev.wconvert-website.pages.dev`; staging allows only the development
address. Wildcards, paths, credentials, HTTP origins or a malformed value fail
closed to `frame-ancestors 'none'`.

`scripts/verify-gallery.mjs` checks previews against the design-only embed v1
fragment protocol: `#screen=<id>&device=desktop|mobile` selects a state without a
reload, `#sample` carries `data-screen`/`data-device`, and an unknown or
duplicate fragment key shows `#error` with no design rendered. If the publisher
changes the preview document, change this section and the verifier together.
An iframe `load` event is not proof the preview rendered; HTTP errors load too.

`examples/design-only-consumer.mjs` is the v2-era website example and is still
imported by `tools/design-library/build/design-only-consumer.test.mjs`; it takes
v2 metadata (`design_only_embed_url` per screen). Build the URL from `preview`
instead when porting it.

## Withdrawn designs and popularity

A design id in the pointer's `withdrawn` leaves the gallery. A row without
`revision` withdraws every revision; a row with one withdraws only that
revision. Withdrawals can change without a new release, so the website sees them
on its next build.

`popularity`, when present, names `/v3/index/<sha>.json`:
`{"schema": 3, "generated": "YYYY-MM-DD", "downloads": {"<id>": n}}`. The counts
are plugin downloads of design objects over the 90 days before `generated`. The
website may sort by them; an id without a count has none recorded.

## Errors and caching

The pointer is `no-cache, must-revalidate` with an ETag; `If-None-Match` returns
304. Everything else is `public, max-age=31536000, immutable` with an ETag.
Missing files return JSON 404, query strings 400, other methods 405, and
oversized or unavailable stored objects 503. Errors are `no-store`.

Size caps the service enforces: pointer 64 KiB, other JSON 256 KiB, HTML 2 MiB,
images 5 MiB.

## Migration from v2

Until the website reads v3, the Worker keeps serving the v2 public read-only
routes from whatever v2 objects remain in the public bucket: `/manifest.json`,
`/packs/<sha>.json`, `/releases/<sha>/manifest.json`,
`/releases/<sha>/designs.json`, `/releases/<sha>/page-N.json`,
`/previews/<sha>.html`, `/thumbnails/<sha>.jpg` and `/assets/free/<sha>.<ext>`. This is temporary, and nothing new is published to
them: the v3 operator scripts neither write, back up nor validate v2 objects.
The v2 premium routes (`/grants`, `/downloads/…`, `/assets/premium/…`) are gone.
Once the website is on v3, delete the `LEGACY` pattern in `src/index.ts` and its
test.

## Local acceptance

```sh
npm run check --prefix tools/template-server
npm test --prefix tools/template-server
npm run verify:gallery --prefix tools/template-server -- /private/release /tmp/gallery-evidence
npm run preview:gallery --prefix tools/template-server -- /private/release
```

The gallery verifier promotes the release into local Workerd/R2, runs the
read-only service verifier, then drives Chromium over every detail's preview in
both widths, decodes each 1× thumbnail and og image, and checks embedding from
allowed and blocked parents. It intercepts every request and makes no hosted
requests; `--remote` checks the live service instead. The preview command
serves the release's public storage on loopback port 9464 and prints a Free and
a premium preview URL; it exposes no private bucket.
