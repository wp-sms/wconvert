# Publishing the template catalogue

The internal team's file-based publisher for catalogue v3
([ADR 0156](../../../docs/adr/0156-the-catalogue-is-one-design-per-object.md),
wire contract in [docs/template-discovery-api.md](../../../docs/template-discovery-api.md)).
It builds a release into a local directory: no R2, Worker, licence or network.
`npm run publish` in [tools/template-server](../../template-server/README.md)
moves a verified directory to the hosted service.

## The files here

| File | Who writes it | What it is |
| --- | --- | --- |
| `catalog.json` | author | Editorial and rights data: extra `designs` published with no setup, `withdrawn`, `image_rights`, `artwork_exports`. What is published is derived, not listed ([ADR 0162](../../../docs/adr/0162-the-delivery-plan-is-derived.md)). |
| `designs.json` | author | Catalogue words per design — `description`, `slug`, `industries`, `occasions`, `style`, `colour`, `family`, `aliases` — and the `taxonomy` (ids and labels) those words come from. |
| `revisions.json` | `npm run templates:revisions` | The registry: each design's and setup's revision, content hash and first-publication order, and every retired id. |
| `colour-baseline.json` | `node build/catalogue-lint.mjs --record` | How many literal colours each existing design has in node tokens. It only goes down. |

`npm run templates:revisions` also writes `resources/templates/revisions.json`
and `pro/resources/templates/revisions.json`, the revision each ZIP's bundled
designs carry; `templates:revisions:check` (and the release build) refuses a
stale one.

## Build a release

```sh
npm run templates:revisions:check
npm run templates:release:local -- \
  --directory /private/wconvert-catalogue \
  --origin https://templates.wconvert.io \
  --expected none   # or the current release id
```

The command rebuilds the renderer and studio, refuses any approval that has
gone stale, publishes every setup with a current approval that exports and
every Collection with a current review, exports every design and setup through the shipping PHP
validator (`build/export-designs.php`), renders WebP thumbnails (1× and 2×), an
Open Graph image and inert previews in a network-blocked browser — premium
pictures downscaled — then runs the shipping `TemplateCatalog` over an
in-memory copy of the whole release before anything is written. Writes are
content-addressed and read back; `v3/manifest.json` changes last. Use a
directory outside the WordPress document root; `private/` must never be served.

```text
public/v3/manifest.json            the pointer, the only mutable object
public/v3/releases/<sha>.json      pages, details, taxonomy, collections
public/v3/index/<sha>.json         index pages, website detail pages, sidecars
public/v3/designs/<sha>.json       Free designs     (private/v3/designs: premium)
public/v3/setups/<sha>.json        Free setups      (private/v3/setups: premium)
public/v3/assets/<sha>.<ext>       Free images      (private/v3/assets: premium)
public/v3/thumbs/<sha>[@2x].webp   card thumbnails
public/v3/og/<sha>.jpg             Open Graph images
public/v3/previews/<sha>.html      inert website previews
```

## Rules the build enforces

- **Approval is unchanged**: an agent-reviewed, current approval for every
  published setup. Nothing here approves anything, and nothing needs listing:
  an approval is the decision to publish.
- **Exactly what a design needs.** `requires.plugin` is the newest `since` stamp
  it uses; `capabilities` is what the reader counts.
- **Never drop a live design silently.** A release that leaves out a design the
  current one lists is refused unless `withdrawn` names it.
- **Every image has a rights record** of a known `kind` (`original`,
  `ai-generated`, `licensed` with its `licence`), bundled designs included.
- **Literal colours only go down** against `colour-baseline.json`.
- **The index fits the reader's budget**: at most 16 pages and 1 MiB, listed
  oldest first so an outgrown reader loses the newest designs, not the oldest.
- An approved setup that cannot export is shown on the website from the
  bundled source, not downloadable, with the exporter's reason, until that is
  fixed. The studio's held panel lists them.

The build reports how many published designs still lack a `description`.

## Verify in WordPress

```sh
WCONVERT_WP_BOOTSTRAP=/path/to/wp-load.php \
WCONVERT_RELEASE_DIRECTORY=/private/wconvert-catalogue \
php bin/verify-template-release.php
```

It installs everything the site can run with the shipping reader, the site's
own plan, salts and plugins, reports what is locked or unavailable, and checks
that it all registers offline. Under Playground, mount the release and run it
through the `php` subcommand (see README → Playground); mount Pro and
WooCommerce to cover premium and commerce designs.
