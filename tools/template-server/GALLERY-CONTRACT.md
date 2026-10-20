# Public design catalogue, version 1

The additive gallery extensions and design-only embedding v1 below were approved and published on 20 October 2026 in release `e03c91ed1bcff606d305e0a796eb750ef8f5f9f97fd308768620b0d9bf6fc68d`. The website can now migrate using the [website handoff](../../docs/reviews/design-only-gallery-2026-10-20/WEBSITE-HANDOFF.md), retaining reviewed snapshots as the unavailable-service fallback.

This extension serves website galleries and design pages. The installation protocol, premium authorization, schema-2 manifest, catalogue pages and old preview URLs remain unchanged. Nothing here grants installation rights.

## Discover one consistent release

1. Fetch `https://templates.wconvert.io/manifest.json` at website build time.
2. Read its existing `release` ID. Fetch `/releases/{release}/designs.json` from the same origin. Updated Workers also advertise that address in the manifest's HTTP `Link` header, with `rel="describedby"` and `type="application/json"`.
3. Require catalogue `schema: 1` and the same `release`. Use that snapshot throughout the website build. Do not refetch the current manifest for every design.
4. Follow the supplied preview, embed and thumbnail URLs. Keep featured selections and marketing copy on the website, keyed by design ID.

Older plugin readers reject unknown manifest/page JSON fields, so this is a separate file, not an extra manifest property. A legacy release has no sidecar and returns 404 for it; the website can retain its reviewed fallback until the first gallery release is published. Never silently replace a previously successful gallery with an empty list after a fetch failure.

The catalogue shape is:

```json
{
  "schema": 1,
  "release": "<64 lowercase hex characters>",
  "designs": [
    {
      "id": "excerpt-window",
      "name": "Excerpt window",
      "pack_id": "publishers-starts",
      "packs": [{"id": "publishers-starts", "access": "free"}],
      "format": "inline",
      "availability": "free",
      "bundled": true,
      "bundle_tier": "free",
      "prerequisites": {"plugins": []},
      "revision": "<design content SHA-256>",
      "screens": [
        {
          "id": "s1",
          "label": "Read a sample",
          "step_id": "s1",
          "preview_url": "https://templates.wconvert.io/previews/<pack-preview-hash>.html#design=excerpt-window&screen=s1",
          "embed_url": "https://templates.wconvert.io/previews/<focused-preview-hash>.html#screen=s1"
        }
      ],
      "preview_status": "available",
      "preview_url": "https://templates.wconvert.io/previews/<pack-preview-hash>.html#design=excerpt-window",
      "embed_url": "https://templates.wconvert.io/previews/<focused-preview-hash>.html",
      "thumbnail": {
        "url": "https://templates.wconvert.io/thumbnails/<image-hash>.jpg",
        "sha256": "<image-hash>",
        "width": 896,
        "height": 376,
        "alt": "Excerpt window — Read a sample. Sample design content.",
        "screen_id": "s1",
        "partial": false
      }
    }
  ]
}
```

This example illustrates the shape; dimensions and hashes must be taken from the actual response. A design can have additional screens.

## Field meanings and identity

- `id` is the authored template ID, independent of name, pack, release and version. Keep it when renaming or editing a design. Assign a new ID only for a genuinely different design; never reuse a retired ID. No slug is generated from the name.
- `pack_id` is the first containing pack in sorted pack-ID order. `packs` contains all delivery choices. Identical designs in multiple packs appear once; conflicting content under one ID stops publication.
- `availability` is the design's declared `free` or `pro` tier. `packs[].access` is the tier needed to download that particular pack. These may differ when a Free design is part of a premium pack.
- `bundled` and `bundle_tier`, when present, record that the same authored ID also ships in a plugin template directory at the source revision used to build this release. This is not a guarantee about every historical plugin version. Do not count the bundled and downloadable copies separately.
- `designs` retains its original scope: reviewed designs in the publishing plan's packs. Opt-in `extensions.bundled_designs` adds currently approved bundled-only designs without changing that array's membership contract. Neither array promotes unapproved local sources.
- `format` comes from `display_type`: currently `popup`, `inline`, `floating_bar`, `slide_in` or `fullscreen`.
- Optional `description` must be explicitly authored public metadata. Current design source files have no design descriptions, so they are absent. Pack descriptions and setup copy are not substituted.
- Optional `prerequisites.plugins` contains actual external plugin requirements. `["woocommerce"]` is emitted for product elements, cart actions, required live product results or configured WooCommerce result sources. These come from installer capability predicates and publish-contract fields. `[]` means the exporter checked and found no external plugin requirement; an absent field means unknown. This describes the design, not every rule or setup supplied in its pack. Categories and capabilities are not inferred from names.
- `screens` includes every screen and every quiz outcome, including the fallback. Screen IDs are authored step IDs, or `step-id/result-id` for a result variant. They survive label changes and reordering. `result_id` is present only for result variants.
- `revision` commits to the design source and its bound artwork hashes. Preview and thumbnail URLs have their own content hashes: they can change when the renderer or presentation changes without changing the authored design.
- `preview_status: "unavailable"` has no preview/embed/thumbnail URLs. Metadata and screens can still be displayed. Normal release builds fail if rendering or thumbnail capture fails; they never quietly publish a broken image reference.
- Thumbnail dimensions describe the actual decoded JPEG. The image captures the complete first screen/outcome, including its full content height. `partial: false` refers to that screen, not the entire multi-screen journey. Alt text names the design and screen. Future intentional crops must use `partial: true`.

An empty `designs` array is valid. A missing ID in a new successful snapshot is removed from the current gallery; its older immutable release and URLs remain available. An edited design retains its ID and receives a changed revision and/or asset URLs. For an unavailable preview, show metadata without an iframe or broken image.

## URL-based previews

This section describes the existing focused viewer. New website consumers should use the separately advertised **Design-only embedding v1** below. The full and focused URLs retain their previous presentation.

Use each supplied `screens[].embed_url` to open that screen immediately. Append `&device=mobile` or `&device=desktop` after its existing fragment parameters. For the design-level `embed_url`, use `#device=mobile`. Fragment values must be URL-encoded; they never become service requests or credentials.

The focused document contains only the requested design's screens, with a labelled native screen selector, keyboard-operable Desktop/Mobile and Right-to-left buttons, visible focus styles and a read-only disclosure. It omits the pack heading and unrelated design navigation. Tall content scrolls within the iframe page. The website owns modal focus trapping, Escape/close controls and focus restoration.

```html
<iframe
  src="THE_SUPPLIED_EMBED_URL"
  title="Preview: Excerpt window"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  loading="lazy"
  style="width:100%;height:min(80vh,900px);border:0"
></iframe>
```

No messaging interface is needed. A parent can switch the iframe's URL to another supplied screen URL. Cross-origin DOM access is unnecessary.

The full-pack `preview_url` remains a normal page with the pack heading and all screens. Newly generated full-pack pages accept `#design=ID&screen=SCREEN_ID&device=mobile`. Old published HTML remains unchanged and retains its original behaviour; use the new catalogue's URLs for direct selection.

Unknown designs/screens, unsupported device values or duplicate/unknown fragment parameters display an accessible error, with no wrong design shown. Since fragments are client-side, the document itself still returns HTTP 200. Missing files return JSON 404, unsupported query strings return 400, and unsupported methods return 405. Unavailable or oversized stored objects return 503. Errors are not cached. An unconfigured private download remains unavailable; configured private routes retain their existing license/grant checks.

## Isolation and public content

The Worker configuration explicitly allows `https://wconvert.io`, `https://www.wconvert.io` and `https://dev.wconvert-website.pages.dev` as embedding parents through `PREVIEW_EMBED_ORIGINS`. Wildcards, credentials, paths, HTTP origins or malformed configuration fail closed with `frame-ancestors 'none'`. Do not allow arbitrary parent-provided origins.

HTML is CSP-sandboxed with scripts but without same-origin, form, popup or top-navigation permissions. Connections are disabled; images/fonts are data URLs; `base-uri` and `form-action` are blocked. Sample inputs are disabled, names removed and link destinations stripped. No lead submission, email, checkout, cart action or installation occurs. Public metadata contains no editable trees, private pack URLs, license keys, passes, credentials or grant records. Public previews intentionally disclose rendered Pro appearance, including flattened artwork, without supplying premium installation payloads.

## Design-only embedding v1

Each available design may advertise this independent capability:

```json
{
  "design_only_embed": {
    "version": 1,
    "url": "https://templates.wconvert.io/previews/<content-hash>.html",
    "devices": ["desktop", "mobile"],
    "default_device": "desktop",
    "mobile_width": 320
  },
  "screens": [
    {
      "id": "s3/fallback",
      "design_only_embed_url": "https://templates.wconvert.io/previews/<content-hash>.html#screen=s3%2Ffallback"
    }
  ]
}
```

Only use the capability when `version === 1`, `preview_status === "available"` and the requested screen advertises a URL. The root extension also advertises `capabilities.design_only_embed: 1`. Legacy `embed_url` and `preview_url` retain their meanings. No query parameter changes an old document into the new mode; each mode has its own immutable bytes and hash.

The document contains only a transparent, neutral canvas, an accessible main landmark and an error region. There is no service header, toolbar, screen selector, disclosure, format label or coloured stage. Horizontal overflow is contained; full content height remains available through vertical scrolling, including keyboard scrolling. Desktop uses the design's authored width constrained to the iframe; mobile caps it at 320 CSS pixels. A narrower iframe constrains either mode further. These are responsive canvas widths, not device/UA emulation.

The parent owns the cream modal, native labelled screen selector, Desktop/Mobile buttons, disclosure, focus trap, Escape/close and focus restoration. Keep `sandbox="allow-scripts"` and `referrerpolicy="no-referrer"` on the iframe. Sample controls and links remain disabled. No parent DOM access, new sandbox permission or `postMessage` protocol exists.

Start with the **supplied per-screen URL**, read its fragment with `URLSearchParams`, set `device=desktop` or `device=mobile`, then assign the resulting URL to `iframe.src`. Preserve the screen fragment when switching device. A fragment-only navigation updates the existing document and renders that exact screen/device pair; it does not select the first screen. Screen IDs are opaque: they may contain multiple slashes, and must never be split into path segments or manually concatenated unencoded.

Missing screen selects the first authored screen; missing device selects desktop. A wholly missing fragment uses both defaults. Explicit empty values, unknown screens/designs/devices, duplicate keys and unknown fragment keys show an accessible error with no design rendered. An optional `design` must match the sole design in the document. Query strings remain unsupported by the service. Invalid state can recover through a valid fragment without reload.

The [website consumer example](examples/design-only-consumer.mjs) accepts validated build-time metadata, renders parent controls, preserves screen/device state and accepts a website-owned service-health decision. A reviewed snapshot URL comes from the website's review manifest for the same design revision. The example never substitutes `embed_url`. An iframe `load` event is **not** proof that a cross-origin service rendered successfully; HTTP errors can also load. Use the website's same-origin health layer and offer the reviewed fallback when unavailable. No unvalidated messages from an opaque sandbox origin are accepted.

## Additive gallery extensions v1

This backwards-compatible extension was approved before publishing bundled-only designs. The existing `schema: 1`, `release` and `designs` fields remain, and every member of `designs` still has a real pack. A separate optional object is added:

```json
{
  "extensions": {
    "schema": 1,
    "capabilities": {
      "design_only_embed": 1,
      "bundled_designs": 1,
      "collection_designs": 1
    },
    "bundled_designs": [],
    "collections": []
  }
}
```

New consumers that understand extension schema 1 concatenate `designs` and `extensions.bundled_designs`, then assert globally unique IDs. Old consumers continue reading `designs` alone. The publisher fails on a duplicate across these arrays. A design moving into a real delivery pack leaves `bundled_designs` and enters `designs` with the **same stable ID**. This is not a new design.

Each bundled-only entry has the same public name, format, tier, prerequisites, revision, screens, thumbnail and embed metadata as a packed design, with `bundled: true`, `bundle_tier`, `packs: []` and **no `pack_id`**. There is no artificial downloadable pack, private tree, download URL or installation endpoint. Internal renderer containers are never stored in either public or private pack storage. Currently approved rendered artwork is flattened into public HTML; editable bundled design JSON is never added to public storage.

The publishing gallery plan selects setup IDs solely to verify current design approvals against renderer-bound revisions and hashed evidence. Design identity comes from the source's `template_id`; labels do not generate IDs. Publication fails when an approval is stale or missing. The normal approved delivery plan remains responsible for packs.

`extensions.collections` supplies exact membership independently of plugin installation pages:

```json
{
  "id": "black-friday-2026",
  "name": "Prepare for Black Friday",
  "description": "Start with early access, a clear offer or a final-day announcement. Review the offer and your own dates.",
  "design_ids": ["edition-pass", "offer-receipt", "bar-countdown", "product-shelf"],
  "items": [
    {
      "setup_id": "sale-deadline",
      "design_id": "bar-countdown",
      "stage": "during"
    }
  ],
  "event": {
    "family": "black-friday",
    "start": "2026-11-27",
    "end_exclusive": "2026-12-01",
    "feature_start": "2026-10-16",
    "feature_end_exclusive": "2026-12-01",
    "date_basis": "site-calendar",
    "end_semantics": "exclusive"
  }
}
```

The example abbreviates `items`; the real array includes all four setup references. Packed members also retain their actual `pack_id` and `pack_digest`; bundled-only members have neither. Multiple setups can reference one design, so `design_ids` is the ordered deduplicated list of the items' IDs. Never infer that a whole pack is seasonal. Existing schema-2 installation collections keep their strict, unchanged shape. A gallery-only collection does not make a new installable pack.

Dates preserve the authored calendar values. They are **not UTC instants** and carry no universal IANA timezone: `site-calendar` means the configured WordPress site's timezone, as in the existing collection contract. A public website must choose and disclose its own calendar timezone for featuring; it must not infer one from the service host. For Black Friday, featuring begins at local midnight on 16 October 2026; the event begins at local midnight on 27 November. Both end immediately before local midnight on 1 December, so the final included day is 30 November. Feature/event start is inclusive; both `*_end_exclusive` values are exclusive. Campaign schedule, countdown timezone, offer, coupon and destinations remain the merchant's responsibility. Installing a design configures none of them.

## Publishing, integrity and retention

The existing release CLI generates focused HTML and real JPEGs from the same renderer used for public pack previews. Chromium captures complete design content; no promotional mockups or AI artwork are introduced. Root npm dependencies and the pinned Playwright Chromium installation are required for release builds.

The release ID remains SHA-256 of UTF-8 `JSON.stringify({packs, collections, designs}, null, 2) + "\n"`, in publisher order. The `packs` and `collections` values are the concatenated existing catalogue pages; `designs` is the sidecar array. When `extensions` exists, every packed design additionally carries `gallery_extensions_sha256`, the SHA-256 of UTF-8 `JSON.stringify(extensions, null, 2) + "\n"`. New validators verify that digest; old consumers can still calculate the same release ID without understanding the extension. The extension requires at least one packed design as its integrity anchor; empty legacy galleries remain supported without it. Legacy releases without a design catalogue hash the same object without `designs`. Page digests retain their existing meaning. Preview and JPEG filename hashes cover their exact bytes. This is integrity checking, not a replacement for trusted HTTPS or publisher authorization.

Local staging, remote publication, read-back validation, read-only verification and backups walk the new dependency closure. A missing sidecar, focused preview or JPEG blocks promotion. Immutable objects are written and verified before `manifest.json` changes, using its existing compare-and-swap guard. Failed uploads leave the old manifest intact. Backup/recovery includes new and retained legacy releases. Nothing deletes older assets.

The current manifest uses `no-cache, must-revalidate`; immutable release JSON, previews and thumbnails use a one-year immutable cache and ETags. GET/HEAD and conditional requests are supported. Public JSON is capped at 256 KiB, HTML at 2 MiB and images at 5 MiB. An over-budget build fails rather than producing a partial catalogue. Breaking catalogue changes require a new schema/endpoint and coordinated website migration.

## Website handoff and deployment

Consume a successful catalogue snapshot at website deployment. Keep editorial choices keyed by stable IDs. Until design-only v1 is published, use verified, sanitized website preview snapshots on every host. Designs without matching reviewed snapshots keep their catalogue pages and show a preview-preparation message. Never silently fall back to the old focused viewer. After migration, use the advertised design-only iframe and retain the reviewed snapshot for unavailable service. Use actual thumbnail dimensions and alt text, with `object-fit: contain` when card aspect ratio differs. Preserve the last valid gallery on network/validation failures.

Deployment requires explicit authorization:

Before future production publication, reconcile the sources with the live catalogue. This checkout's six-pack plan must not replace the live eight-pack release. The complete reviewed sources were located in the clean `codex/template-gallery-integration` checkout; the [release report](../../docs/reviews/design-only-gallery-2026-10-20/README.md) records its source commit, the published 50-design release and unchanged delivery-pack hashes. Recheck the current manifest immediately before publication; use its exact expected-release guard.

1. Verify that the Worker supports sidecar/thumbnail paths and all three approved embedding origins, retaining its existing private bindings, rate limits and Nexus configuration. The observed live service already does; design-only v1 uses existing preview paths and does not itself need a Worker deployment.
2. Build and validate a new approved release for `https://templates.wconvert.io`, then publish with the current release guard using the existing publisher.
3. Run public remote acceptance and browser checks on the approved website origins. Existing plugin catalogue validation is exercised by the release builder; no plugin update is required.
4. Update the website consumer separately. The implementation in this repository does not modify or deploy the website.

Do not publish the new sidecar/thumbnail release through an old Worker: it will reject the new paths. Do not remove old assets during this migration. A rollback to a legacy release removes the `Link` advertisement and requires the website's legacy fallback.

Local acceptance and review:

```sh
npm run check --prefix tools/template-server
npm test --prefix tools/template-server
node --test tools/design-library/build/design-catalogue.test.mjs \
  tools/design-library/build/public-preview.test.mjs \
  tools/design-library/build/publisher.test.mjs
npm run verify:gallery --prefix tools/template-server -- /private/release /tmp/gallery-evidence
npm run preview:gallery --prefix tools/template-server -- /private/release
```

The gallery verifier intercepts HTTPS requests into local Workerd/R2, checks every screen in both layouts, decodes thumbnail dimensions, exercises keyboard controls and browser-enforced embedding restrictions, and makes no hosted requests. The preview command uses fresh in-memory public storage on loopback port 9464 and prints working local Free/Pro URLs; it exposes no private bucket.
