# Template discovery API reader contract

Implemented client boundary: `DiscoveryRelease`, `TemplateCatalog` and the
explicit refresh/install endpoints. Public discovery, Free packs and Free/Pro
previews are anonymous. Pro premium pack/media downloads use the SDK credential
only at a separately pinned HTTPS API origin; Nexus grants access to the exact
immutable pack and its images. Installed campaigns keep working offline.

The local publisher, Worker/R2 adapter, signed-grant verifier and WordPress
transport are implemented and tested locally. There is no default hosted URL,
background download or remote executable content. Real R2, credentials, remote
publishing and live HTTPS acceptance remain deployment work. The
[setup guide](../tools/template-server/CLOUDFLARE-SETUP.md) describes one hosted
**WConvert Template Library** environment; no separate staging environment is
required before launch. Downloadable trees still reject arbitrary remote image
URLs and executable content; raster assets use the verified manifest contract.

## Immutable release format

Configure `wconvert_template_catalog_url` with an HTTPS manifest URL. A schema 2
manifest contains only:

```json
{"schema":2,"release":"<64 lowercase hex characters>","pages":[{"url":"https://catalog.example/releases/release-a/page-1.json","sha256":"<SHA-256 of exact page bytes>"}]}
```

Each page contains only `schema: 2`, the identical `release` value, `packs` and
`collections`. Pack rows use the existing schema 1 catalog pack metadata and
validation. The release identity is an opaque digest-shaped identifier; page
hashes and exact pack digests bind the bytes. It is not a digital signature.

A collection declares `id`, `revision` (64 lowercase hex characters), `name`,
`description`, `cover`, `priority`, `business_types`, `markets`, `items`, and an
optional `event`. Current covers are `sale`, `launch`, `services`, `reading`;
businesses are `stores`, `services`, `publishers`; markets are explicit uppercase
two-letter codes. Text is plain, with no markup/control characters. Priority is
an integer between -1000 and 1000. Items contain only:

```json
{"pack_id":"store-starts","pack_digest":"<exact pack SHA-256>","setup_id":"welcome-offer","stage":"during"}
```

The setup ID is the logical ID within that pack. The referenced pack must be in
this same release with this exact digest; duplicate members are refused.
Collections become usable only when the exact referenced release and logical
setup are installed and available locally. Runtime IDs use a separate catalog
namespace; delivery packs do not become duplicate curated collections.

An event declares `family`, `start`, `end_exclusive`, `feature_start`,
`feature_end_exclusive`, all real `YYYY-MM-DD` calendar dates except the family
identifier. Feature start is no later than event start; feature end is no later
than event end. Compare in the WordPress site timezone. For Black Friday 2026,
27–30 November inclusive is `[2026-11-27, 2026-12-01)`.

## Bounds and failure behaviour

At most 16 pages, 256 KiB each, 2 MiB combined; at most 50 packs and 100
collections per release; 100 members per collection, 20 audience/market labels.
IDs, capabilities, duplicate entries and unknown fields are validated. Page
URLs share the configured scheme/host/port and have no credentials or fragment.
Safe WordPress transport retains the existing HTTPS, 15-second timeout and
no-redirect policy. Only the current site's host has the existing local-environment
HTTP exception. Remote images, HTML, CSS, scripts and scheduling commands are
not accepted by this collection format.

Any failed page, mismatched hash, mixed release or invalid reference rejects the
whole refresh and retains the previous cache. Installing packs is still explicit
and separately validates exact bytes; no collection automatically installs
packs, starts campaigns or publishes. Offline use relies on installed data.

Schema 1 catalogs continue through their existing path but do not accept remote
collections. Publisher tooling must emit pages first, then the manifest last,
retain immutable bytes, and validate with this reader before deployment. The [local publisher](../tools/design-library/publishing/README.md) now emits
this format from current shared reviews and verifies it with this reader. A
hosted publishing adapter remains future work. Confirm the service's endpoint, supported
languages, entitlement and approved media contract before expanding this format.

## Local customer state

`GET /wconvert/v1/picker` reads collections and blog-scoped user preferences,
site occasions, Saved design names and authoritative site time. Manage-options
permission is required. Preference/occasion PUT routes require the last document
revision; a conflict returns 409. Favorites and preferences stay in WordPress,
not the catalog API. These routes neither expose Leads nor edit Optins.

The local preference document also accepts `show_featured` as a strict boolean.
Hiding the shelf does not disable Browse collections or opt out of an event.
`businesses` ranks matching collections first without excluding other businesses.
Both preferences remain scoped to the authenticated WordPress user and blog.

### Implemented local extensions (2026-10-01)

A catalog row may supply `preview_url` on the catalog's own origin and `access: free|premium`. The plugin opens the generated public showcase without downloading/installing the editable pack. Showcase HTML renders every design screen/result variant, disables form actions, and supports desktop/mobile/RTL. Both tiers share the same preview generation path.

Pack schema 2 adds capability `pack-images:1`, `assets`, and `image_bindings`. Example binding: `{ "template_id": "reading-slip", "node_id": "n99", "asset_id": "cover" }`. The asset descriptor contains `id`, `sha256`, `bytes`, `mime`, `width`, `height`, `access`. It never contains an arbitrary download URL. The client derives `/assets/free/<sha256>.<png|jpg|webp>` from the configured origin, verifies the complete required set, and substitutes stable local URLs only at read time. Stored JSON remains byte-identical to the inspected digest. Premium media use the explicit Pro transport and Nexus grants described in the [staging service](../tools/template-server/README.md); unconfigured services remain closed. Existing schema-1 empty-asset packs remain compatible.

Picker responses may contain `country_suggestion: {code, timezone}` or null. Preferences include `country_suggestion_dismissed`, the named timezone the user dismissed. A timezone is only a suggestion for countries served; it is not visitor geolocation. No IP lookup, automatic market write or fixed-offset guess is used.


### Current compatibility rehearsal (2026-10-12)

The local delivery plan now exports 22 setups, 19 designs and three complete editorial collections in five packs, including one private premium pack. The pack reader accepts declared `template-tree:3` routes and `paid-campaign-rules:1` for supported, tier-authorized targeting. Site-specific rule IDs and authored URLs remain forbidden. Existing immutable versions remain readable offline after an update.

Public result previews show inert product samples where appropriate and hide absent optional destination links. Pack source JSON remains separate. `WCONVERT_VERIFY_PREMIUM_FIXTURES=1` is only an opt-in local verification transport; it is not part of the hosted contract, and cannot grant customers access. R2/Worker provisioning, real credentials and live staging authorization/rollback checks remain future work. The local Nexus adapter is implemented and tested; see the [staging service](../tools/template-server/README.md).

### Nexus download contract (18 October 2026)

Public schema 2 discovery is unchanged. A premium row dispatches through
`CatalogPackTransport` registered by Pro; Free cannot download premium source.
The Pro adapter pins `WCONVERT_TEMPLATE_API_ORIGIN` independently of the catalogue
option, posts the SDK key in `X-License-Key` to `/grants`, then uses the returned
pass in Authorization headers for `/downloads/<pack-sha>.json` and its private
images. It never sends credentials to public reads or arbitrary catalogue URLs.
No stored licence status/plan is interpreted as server authorization.

All installed-pack integrity and local-media rules remain unchanged. A refusal
cannot install a partial pack or change a campaign. Expiry affects new downloads,
not already imported content. This is locally implemented; production credentials
and HTTPS staging acceptance remain pending.
