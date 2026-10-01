# Template discovery API reader contract

Implemented client boundary: `DiscoveryRelease`, `TemplateCatalog` and the
existing explicit refresh/install endpoints. There is no default hosted service,
background request, new paid entitlement or remote executable content.

Planning update, 1 October 2026: the
[hosted delivery extension](plans/template-picker-and-collections-2026-09-30.md#hosted-delivery-extension--implementation-status)
specifies public Free/Pro preview parity, private premium downloads through the
existing licence manager, verified local media import and reuse of unchanged
immutable files. R2 is recommended; no R2 bucket or Worker is provisioned. A
Worker is optional if the existing backend can provide the download API. A local-directory
publisher now exists; isolated image and authorization foundations are tested
without cloud setup. They are not yet connected to live media/premium downloads. The protocol below
is the implemented reader, not that future extension: assets, credentials,
external demo URLs and cross-origin signed download fields are not implicitly
accepted. Those require an explicitly versioned and tested contract.

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
