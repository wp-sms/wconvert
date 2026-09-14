# Curated template collections

Build the local catalog from the existing reviewed designs:

```sh
php tools/template-catalog/build.php
wp option update wconvert_template_catalog_url \
  http://wconvert.local/wp-content/plugins/wconvert/tools/template-catalog/out/index.json \
  --autoload=no
```

| Collection | Existing designs |
|---|---|
| Store collection | Fieldwork, Punched ticket, The summer archive |
| Publisher collection | Sunday marginalia, Inline rule, A useful little guide, Reading slip |
| Service collection | Callback notes, Choice card, Ready for launch |

These are ten existing Free designs, packaged unchanged. They remain bundled;
installing a collection adds separate versioned copies, not new compositions.
The membership is intentionally smaller than the twelve flagship Playbooks:
cart behaviour belongs to a campaign setup, and Photo offer contains embedded
artwork that the placeholder-only installer refuses. Packs contain designs and
sample copy, not campaign targeting, destinations or fulfilment configuration.

## Build and release

`collections.json` is the membership/version/compatibility definition. Each
source fingerprint pins the reviewed JSON bytes; the design itself stays in
`resources/templates/library/`. The builder refuses a changed source, duplicate
membership, incompatible pack or replacement of an existing release file with
different bytes. It also enforces the catalog's 20-collection limit and unique
collection IDs. It validates every pack with the shipping installer before
writing. Packages and index use temporary files and atomic renames; the index
is replaced only after all packages are available.

The first argument is the serving directory URL; the optional second is the
output directory. For a future hosted release, build into a staging directory:

```sh
php tools/template-catalog/build.php https://YOUR-CATALOG-HOST/collections /tmp/wconvert-catalog-release
```

Replace that example host with the chosen service. HTTP is accepted by the
installer only for the current site host with `WP_ENVIRONMENT_TYPE=local`;
production requires HTTPS. No production service is configured or deployed.

On a design change, review it again, update its fingerprint and bump its
collection version. Keep old release files. Upload the versioned pack files
first and `index.json` last; do not edit a published package in place. A rebuild
with unchanged inputs produces identical package bytes. Uploading the output
is a separate release step; do not expose a build-in-progress directory as a
production catalog. Run one builder per output directory.

The original three-design sample is no longer advertised in the generated
index. Its old files and installed copies are retained, so existing references
and offline previews still work. The builder never deletes previous packages.
`out/` is ignored, and tools are excluded from both plugin release ZIPs.

## Use and verify

Open a draft, choose **Change template → Template packs → Check catalog**.
Preview a collection, inspect designs/screens at desktop or 320px, then install.
**Preview and use this design** returns to the existing keep/sample-content
preview. It respects the draft's display format and existing compatibility rules.
Before publishing, replace sample copy, codes, destinations and resource URLs,
and configure real consent, schedules and delivery where required.

```sh
vendor/bin/phpunit tests/unit/Template/Catalog/CuratedCollectionsTest.php
composer verify:templates
```

The test builds the actual static files, checks their hashes, previews/installs
all three packs, verifies all ten trees and styles against the bundled originals,
prepares the same editor snapshots, and checks offline access, repeatable builds
and refusal to replace an existing release. Exact tree equality includes mobile
styles, so the earlier responsive reviews still apply. No renderer changes or
new artwork are introduced by packaging.

Index contract: `schema: 1`, `packs: [{id, version, name, description, url,
sha256}]`; at most 20 packs. Pack examples are generated JSON. Minimum
plugin/tree/capability declarations are mandatory. Pack URLs share the index
origin. Only Free popup/inline packs with empty assets are supported. Remote
service strings must be localised by that service; bundled PHP translations are
unchanged.

Installed JSON lives in uploads/wconvert-template-packs. Back it up with the
site. The archive is capped at 128 files; refresh never deletes old baselines.
No media or remotely supplied code is installed.
