# Template files replace only reviewed draft designs

Accepted 3 October 2026. Implements the [file transfer plan](../plans/template-import-export-2026-10-02.md).

Merchants can export the current editor snapshot, including unsaved edits, and
import one `.wconvert.zip` into a campaign's working draft. Both actions live in
Campaign actions and are available in Free. Actual journey/display capabilities
still require the supplying edition. This does not install a library entry,
create a reusable template collection, or back up an entire campaign.

## Content and review

File import defaults to **Use file content**. **Keep my current content** uses
existing Slot Roles and picture matching, explains that unmatched content may be
lost, and previews the actual replacement. Group ordinary action links by address
for explicit Keep or Change; never infer another site's domain. Mode and link
changes require another preview. Apply is one Undo step and neither saves nor
publishes. The normal save/publication rules remain authoritative.

Content matching preserves the incoming version-3 journey graph. Validate the
complete candidate after matching, privacy preparation and link changes, and
again before Apply; validating only the original file does not cover these
transformations. Existing image URLs are checked separately from the candidate's
structural contract.

Keep the receiving Goal and campaign settings. Reuse existing A/B, destination
and content-lock refusals. Review format-dependent placement resets, privacy
preparation, and clearing form-specific destination overrides/field mappings.
Drop source product selections. Remint leaf identities and rewrite internal
question/field/consent references. Clear `template_id`: the imported design is an
owned snapshot, not a registry identity. A later library switch with no source
identity carries its words, links and unambiguously matched pictures.

## Package and media boundary

One ZIP contains `design.json` and SHA-256-named PNG/JPEG/WebP files. Its envelope
records format/schema, exporter version, design, assets, slot bindings and review
notes. Requirements are derived from content using existing validators, not
trusted metadata. Unknown structure is refused before normalization. Portable
validation accepts merchant URLs and visible consent without changing curated
pack restrictions or introducing another validator framework. Library gzip lint
is not the merchant draft admission limit.

Limits: 256 KiB JSON, 16 unique images, 5 MiB/image, 20 MiB total image bytes,
4096 pixels per dimension, 25 MiB ZIP, 17 entries, 200 nodes and depth 12. Host
limits can be stricter. Reject unlisted paths, duplicates, symlinks, encryption,
unknown versions, unsafe values and mismatched bytes/dimensions/digests. Read
bounded streams using PHP 8.1 APIs; never extract arbitrary archive paths.

Export resolves local uploads/plugin images and known attachment renditions.
Remote-only/unsupported pictures require explicit omission. Built-in SVG art is
a digest reference to exact art already present on the receiving install; no
uploaded SVG is rendered. Missing art is disclosed for explicit review or cancel.
No remote image fetch, embedded code, font download or resource-file packaging.

Stage privately outside the web directory for 30 minutes, one session per site
and administrator. Raster previews use authenticated, non-cacheable responses
and revoked browser blob URLs. Shared preview locks allow concurrent images;
mutating operations hold an exclusive lock. Cancel/expiry removes staging. A
new upload invalidates the old session before replacing its archive.
Replace its scheduled cleanup deadline too: WordPress deduplicates identical
single events within ten minutes, so simply adding another event can leave the
replacement session without an eventual cleanup.

Apply revalidates support and the prepared digest, then uses WordPress sideload
APIs for images still used by the candidate. Check upload capability, MIME policy
and multisite quota. Checkpoint attachment IDs and cache the completed response
for retries; remove newly created media on a handled failure. Successful media
remains available after Undo/discard for Redo and other uses. A process crash can
leave an unused attachment; there is no cross-import deduplication or automatic
orphan-media collector. No table or column is added.
