# Website handoff: design-only embeds and complete gallery

Published release: `e03c91ed1bcff606d305e0a796eb750ef8f5f9f97fd308768620b0d9bf6fc68d`.
The bundled-only contract is approved and the service is live. Publication and
live verification are recorded in [the release report](README.md): 540 preview
checks, all 50 thumbnails, all three approved embedding origins, protected
endpoint refusals and live WordPress installation/offline recovery passed.
A temporary browser iframe in the actual staging website retained the quiz
outcome while switching mobile/desktop. This handoff does not itself modify or
deploy the website.

## Fetch one release snapshot

At build time fetch [the current manifest](https://templates.wconvert.io/manifest.json),
then the sidecar for its exact `release`. For this release:

[Public gallery JSON](https://templates.wconvert.io/releases/e03c91ed1bcff606d305e0a796eb750ef8f5f9f97fd308768620b0d9bf6fc68d/designs.json).

Require sidecar `schema === 1`, matching release, and `extensions.schema === 1`
before consuming the extension. Preserve the previous successful catalogue if
fetching or validation fails. Follow supplied asset URLs; do not refetch the
current manifest independently for each design.

The website inventory is now:

```js
const extension = catalogue.extensions;
if (extension?.schema !== 1) throw new Error("Unsupported gallery extension");
const designs = [...catalogue.designs, ...extension.bundled_designs];
if (new Set(designs.map(design => design.id)).size !== designs.length) {
  throw new Error("Repeated public design ID");
}
const collections = extension.collections;
```

Expected inventory: **50 unique designs, 90 screens/outcomes, 50 thumbnails,
eight delivery packs, nine gallery collections and all five formats**:
22 popup, 19 inline, five slide-in, two floating-bar and two fullscreen designs.

The original `designs` array still holds 32 pack designs. The other 18 are in
`extensions.bundled_designs`. These entries have `bundled: true`, a real
`bundle_tier`, `packs: []` and no `pack_id`. Do not invent pack membership or a
download link. `availability` describes the design tier; `packs[].access`
describes that pack's download tier. Preserve those distinctions in labels.
Bundled metadata describes the approved source revision, not every historical
plugin release.

## Switch the preview presentation

Use only `design.design_only_embed.version === 1` with
`preview_status === "available"` and a supplied per-screen
`design_only_embed_url`. Both packed and bundled-only entries advertise it.
The extension also advertises `capabilities.design_only_embed: 1`.

The website keeps its cream modal, disclosure, screen selector and
Desktop/Mobile controls. The service document is a transparent design canvas
without the old green toolbar, disclosure or stage.

```js
function previewUrl(design, selectedScreenId, device) {
  if (design.preview_status !== "available" ||
      design.design_only_embed?.version !== 1 ||
      !["desktop", "mobile"].includes(device)) return null;

  const screen = design.screens.find(item => item.id === selectedScreenId);
  if (!screen?.design_only_embed_url) return null;
  const url = new URL(screen.design_only_embed_url);
  const params = new URLSearchParams(url.hash.slice(1));
  params.set("device", device);
  url.hash = params.toString();
  return url.href;
}
```

Keep `selectedScreenId` in parent state when changing device. Do not reset it
to the first screen. Treat IDs as opaque strings: `match/explore` is one screen
ID, not a path. `URLSearchParams` encodes slashes correctly.

```html
<iframe
  title="Preview: Coffee finder board"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  loading="lazy"
  style="width:100%;height:min(80vh,900px);border:0;background:transparent"
></iframe>
```

Assign `src` from `previewUrl`. Desktop follows the design's authored width
within the iframe; mobile caps the canvas at 320 CSS pixels. Both shrink to a
narrower iframe. Tall designs scroll vertically. Missing screen/device values
default to the first screen/desktop; invalid, empty, duplicate or unknown
fragment values show an accessible error without displaying a wrong screen.

Use a labelled native screen selector and keyboard-operable device buttons.
Keep modal focus trapping, Escape/close and focus restoration in the website.
No cross-origin DOM access, CSS hiding or postMessage interface is needed.

The [complete consumer example](../../../tools/template-server/examples/design-only-consumer.mjs)
demonstrates controls, screen retention and service-health fallback.

Direct examples:

- [Free design-only preview](https://templates.wconvert.io/previews/1a9ba33a80e014c85a30ab682b3bf0c28d425f695016d43b8aaf4b5a4778583b.html#screen=s1&device=desktop)
- [Quiz outcome on mobile](https://templates.wconvert.io/previews/7a17dfa3f72abad2607168709f3109e5e03a4c472748145bcc7acbb32a79e7e8.html#screen=match%2Fexplore&device=mobile)
- [Bundled-only fullscreen design](https://templates.wconvert.io/previews/867f76cbef692572bc9651ba430f4ba81f710e9ad3728c26faf67dfb5dbd7edc.html#screen=invitation&device=desktop)

## Retain the reviewed fallback

After migration, use the design-only iframe when the capability and service are
available. Retain the website's verified, sanitized snapshot for that design
revision as the unavailable-service fallback on every host. Do not infer
successful rendering from an iframe `load` event: HTTP error documents can
also load. Use the website's same-origin health/fetch layer.

If there is neither a usable design-only preview nor a matching reviewed
snapshot, keep the catalogue page and display “This design’s preview is being
prepared.” Never substitute the old `embed_url` or green full/focused viewer.
Existing full/focused URLs remain supported for old consumers.

## Use exact collection membership

Read `extensions.collections`, not the installation page collections, for the
website gallery. Use each collection's `design_ids` for display and its
`items[].design_id` for before/during/after grouping. Packed items retain actual
pack/setup references. Bundled-only items carry setup/design IDs without a
pack. Multiple setups may reference one design; deduplicate by design ID.

`black-friday-2026` contains exactly:

- Before: `edition-pass` (`edition-early-access` setup).
- During: `offer-receipt` (`first-order-receipt`) and `bar-countdown` (`sale-deadline`).
- After: `product-shelf` (`homeware-care-notes`).

Never infer that all of Stores starting points or Homeware care belongs to
Black Friday.

Preserved event metadata:

```json
{
  "family": "black-friday",
  "start": "2026-11-27",
  "end_exclusive": "2026-12-01",
  "feature_start": "2026-10-16",
  "feature_end_exclusive": "2026-12-01",
  "date_basis": "site-calendar",
  "end_semantics": "exclusive"
}
```

These are calendar dates in the configured WordPress site's timezone, not UTC
instants. The website must explicitly choose/disclose its own calendar timezone
for featuring. Starts are inclusive; ends are exclusive. Both windows include
30 November and exclude 1 December. Avoid converting date-only strings through
an implicit browser or server timezone.

Installing a design does not configure an offer, coupon, campaign schedule or
countdown deadline. Keep that distinction in seasonal copy.

## Security and acceptance

Embedding parents remain exactly:

- `https://wconvert.io`
- `https://www.wconvert.io`
- `https://dev.wconvert-website.pages.dev`

Keep the iframe sandbox and referrer policy. Do not add same-origin, forms,
popups, top-navigation or arbitrary origins. Sample actions remain disabled.
No editable private design JSON or installation credentials are exposed.

Before website deployment, verify the 50-ID union, all five formats, exact
Black Friday membership, desktop/mobile screen retention (especially quiz
outcomes), keyboard modal controls, overflow/scrolling, service outage with a
reviewed snapshot, and missing-snapshot preparation messaging.

The source website still needs its normal implementation/build checks and
deployment. The backend release and its temporary-browser staging verification
do not perform that migration.

[Full versioned contract](../../../tools/template-server/GALLERY-CONTRACT.md).
