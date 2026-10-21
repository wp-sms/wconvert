# 0161: Used template artwork belongs in Media Library

Accepted 2026-10-21. Amends 0082 and 0156. Complements file import in 0113.

Bundled and online-gallery raster artwork becomes WordPress media when a campaign
is created or its design is saved. Reading the library, preparing a candidate,
previewing or installing a gallery design creates no attachment. The gallery
continues to download JSON and separate verified image files; its cache and the
bundled files remain the sources for future template uses.

After normal configuration and campaign checks, the shared campaign write
controller adopts only image URLs beneath the exact bundled Free/Pro artwork
and verified gallery image directories. Content-addressed filenames, file
containment and SHA-256 verification constrain local reads. It never fetches a
URL, adopts arbitrary merchant uploads, or imports CSS/vector decorations.
Ordinary image blocks and root, screen and narrow backgrounds share the existing
image-slot walker. The stored draft and response carry the attachment URLs;
published snapshots are not changed by saving a draft.

WordPress's media sideload API owns files, metadata and thumbnails. New imports
require upload permission, permitted MIME and available multisite quota. A
private attachment meta value records the original artwork digest in existing
WordPress storage; no table or column is introduced. One site-local file lock
serializes lookup/import. Repeated artwork is reused across campaigns, sources
and slots, including Free and Pro sources with the same bytes. Titles name
WConvert, the template where available, and the image/background slot.

A missing or trashed attachment is not reused; a later use of the source artwork
creates a new copy. Previously saved attachment URLs are ordinary merchant
content and are not repaired or replaced silently. Editing/deleting a shared
image has WordPress's normal effects on all places using it. There is no usage
index or custom deletion guard in this change.

Handled preparation failures delete only attachments created during that
attempt and refuse the campaign write. Successful copies remain after Undo,
discard or campaign deletion. A process interruption or a subsequent database
write failure can leave unused media; there is no automatic orphan collector.
Existing campaigns adopt managed source URLs on their next explicit save; no
bulk rewrite or public-page import runs.

Manual ZIP import still adds its packaged raster files on Apply under 0113,
including its own retry/rollback behavior. Cross-ZIP-import deduplication is not
changed by this decision.

Verification: `bin/verify-template-media.php` runs against disposable WordPress
and exercises creation, save, bundled/gallery sources, reuse, deletion recovery,
permission and failure boundaries. Unit checks constrain accepted local sources.
