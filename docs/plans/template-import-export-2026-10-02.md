# Template file import and export

Status: Implemented on `codex/template-portability-plan`, 3 October 2026. All five user decisions are retained. No deployment or merge. See [ADR 0113](../adr/0113-template-files-replace-only-reviewed-draft-designs.md) for the implemented contract and the verification record below.

## Intended outcome

A merchant can download the design currently open in the editor, then import that file into another campaign or another WConvert site. Supported images travel with it. The import previews the actual replacement before changing the working draft. Saving and publishing remain separate actions.

Example: build a three-screen summer offer on a staging site, export it, open a campaign on the production site, and import the file. Its appearance, wording, fields, screens, and supported images transfer. The production campaign keeps its own Goal, targeting, schedule, destinations, identity, and history. Any incompatible settings are explained before Apply.

## Decisions and boundaries

| Topic | Decision | Status |
| --- | --- | --- |
| First release | File import/export only; no custom-design library or Save as reusable design | Confirmed by user |
| Images | Include supported images in a portable file | Confirmed by user |
| Access | Import/export available in Free; existing paid capabilities retain their requirements | Confirmed by user |
| Content on import | Default to Use file content; offer Keep my current content | Confirmed by user |
| Existing links | Show actual URLs for review; allow explicit Keep or Change; never guess a replacement domain | Confirmed by user |
| Entry points | Both actions in the editor overflow menu; no second library entry point in v1 | Recommended |
| Import destination | Current working draft; start a campaign through the existing Goal-first flow when needed | Recommended |
| File granularity | One design per file | Recommended |
| Export source | Current editor state, including unsaved edits, after server validation | Recommended |

No full campaign backup/restore, bulk transfer, catalog publishing, cross-site sync, revision manager, custom CSS/HTML/JavaScript, font packaging, PDF/resource attachment packaging, or third-party builder imports in this release. The existing Saved filter remains personal bookmarks. Imported files never become catalog packs or personal library entries.

## Keep the implementation small

- One file format, one design per file, one dialog per action, one place to find both actions.
- One export request returns either the package or actionable problems. Retry that request with explicit omissions; no persistent export session, download-token service or export history.
- Keep short-lived import staging because verified image previews and retry-safe media creation need it. Do not build resumable uploads, a task queue, cross-device sessions or a general workflow engine.
- Use native WordPress attachments and existing campaign history/readiness rules. No custom media library, new database schema, new publishing rules or automatic media garbage collector.
- Reuse concrete helpers where they fit. Do not refactor the whole catalog into a generic package framework to implement one file operation.
- Deduplicate images within a file and retries of one import session. Defer cross-import content-addressed attachment lookup until actual duplicate-media usage justifies it.
- Prefer a few cohesive modules: package codec/validation, import session/media handling, controller, and dialog. The names below describe responsibilities, not a requirement for a class per step.

The complexity worth retaining is bounded file validation, preview-before-Apply, checking existing capability/compatibility rules, and one undoable draft change. These directly prevent a broken import or an unexpected campaign change.

## What travels

| Data | Behavior |
| --- | --- |
| Layout, global/scoped styles, narrow-width overrides | Include supported vocabulary values |
| Text, field labels, button text, structured emphasis, consent wording | Include as file content; expose current-content alternative on import |
| Fields, options, required flags, screens, questions, branching, results, submission structure | Include when valid and supported by the receiving install |
| Display format | Include actual campaign format, rather than inferring it from its original library entry |
| Image blocks and background images | Include verified supported bytes and portable bindings, including narrow overrides |
| Image alt text, crop/focus, shape and placement | Preserve |
| Ordinary merchant-authored links | Carry only supported schemes; review before Apply |
| Automatically resolved privacy/cart links | Preserve their semantic placeholders; resolve against the receiving site's settings |
| WooCommerce product IDs | Remove source-site IDs; preserve the need to select products and explain it |
| Goal, targeting, triggers, schedule, frequency, placement, teaser, destination bindings and provider mappings | Do not export; existing receiving-campaign settings follow the compatibility rules below |
| Credentials, leads, consent records, analytics, identifiers for campaigns/users/connections, license keys | Never export |
| Custom copy such as business name, phone number, offer code, or contact address | Preserve as deliberate design content; show the preview so merchants can review it |

Consent wording is design content; historical consent evidence is not. Import does not establish that a campaign's privacy setup is appropriate. Run the existing purpose-based privacy preparation and readiness checks, and show any automatic adjustments in the reviewed candidate.

## Customer flows

### Export design

1. Choose **Export design** from the editor's overflow menu.
2. A compact dialog says **Exports the design currently shown, including unsaved changes**. Derive the filename from a sanitized campaign/design name; no filename editor is needed. Do not save the campaign as a side effect.
3. Server preparation validates the submitted design and derives feature requirements from actual content. Take the display format from campaign configuration; the developer helper currently infers it from library provenance and is insufficient here.
4. Inventory pictures at every supported position. Read supported local media and recognized plugin assets through controlled resolvers. Deduplicate identical images within the file.
5. If pictures cannot travel, identify them by screen/block with a useful reason. Offer **Back to editor**, **Export without these images**, or Cancel; reuse the editor's image controls instead of embedding another media picker here. Never report a complete portable export while retaining hidden dependencies on the old site. Omissions clear the corresponding package slots, preserve layout/alt text, and add bounded notes; they do not clear images in the current draft.
6. Download a single `summer-offer.wconvert.zip` containing a JSON document and the included image files. No ZIP knowledge or JSON editing is required from the merchant.

Use one package shape for designs with and without images. The export is an allowlisted projection of the draft, never a serialized campaign object with a denylist bolted on afterward.

Export accepts a structurally valid unfinished draft. Missing destinations, a not-yet-chosen product or an empty required action URL are setup work, not export failures. Invalid branching, unsupported syntax, corruption and package limits are different: explain these and stop. If the editor changes while export is being prepared, the file contains the state captured when Export was clicked; do not mix later edits into it.

### Import design

1. Choose **Import design** from the editor overflow menu, then choose or drop one file. Explain that it replaces the draft's design after review. Existing unsaved edits remain until Apply.
2. Upload into short-lived staging; validate before rendering any imported content. Show filename, design name, format, included image count, and compatibility results.
3. Preview every screen and relevant result, with desktop/mobile controls. Reuse the existing preview components and content transfer machinery.
4. **Use file content** by default; **Keep my current content** as an alternative. The latter uses existing Slot Role, merchant-link and picture transfer rules, with unplaced/unverified content explained. Questions and answer routing retain their semantic dependencies.
5. Show a concise **Needs review** list for links, missing images, removed source product selections, form changes, and format-dependent settings. Group identical carried URLs with their button/screen labels; offer one **Keep these links** action or edit individual URLs. Review only links used by the final candidate, not discarded file content. Do not require a click for every repeated link. Empty required actions may be left for editing, but must remain visible to publish readiness. Links in the preview do not navigate or submit.
6. Prepare one server-validated candidate from the file, current draft, chosen content mode and review choices. If any inputs change, prepare and preview again. A stale response must not replace a newer preview.
7. **Apply to draft** installs included media that the final candidate actually uses, then applies the reviewed design plus the disclosed compatibility changes as one history action. The only unreviewed substitution allowed is changing verified preview-image URLs into their permanent URLs for the same image bytes. It neither saves nor publishes the campaign.
8. Close the dialog, restore focus, and show **Design imported. Review it, then save your draft.** One Undo restores the complete pre-import draft state, including its source reference and affected configuration. Redo reuses the imported local images.

Cancel, validation failure, upload interruption, expired staging, disk failure, incompatible features and preparation failure leave the current draft and live campaign unchanged. Re-importing the same file is an ordinary replacement action, not an installation/version-update conflict.

### Compatibility with the receiving campaign

- Retain the receiving Goal and its existing conversion/publish contract. Match the current picker distinction between advisory Goal mismatch and hard incompatibility; do not create a stricter import-only prohibition. Explain mismatches; the import does not silently switch the Goal.
- Respect the existing A/B sibling conversion rules, bound-destination rules, content-lock compatibility, and supported display formats. Hard conflicts block Apply with a concrete reason.
- If the display format changes, show the same placement/inline-placement/content-lock/teaser resets the current picker requires. Include these resets in Undo.
- Preserve existing destination connections when valid, but do not accidentally attach old per-submission or per-question mappings to imported structures merely because IDs match.
- For v1, clear receiving per-submission overrides and integration mappings on design replacement rather than guessing semantic matches from names or IDs. Keep unaffected campaign-level destination connections; explain which form-specific settings need review and include these resets in Undo. The same rule applies in Keep my current content mode, because it transfers content into the incoming structure rather than preserving the original structure.
- Scope identities to the receiving campaign using existing identity/reference machinery. Avoid collisions with the replaced design's translation identities and incompatible journey references; preserve every internal branch/submission reference when remapping. Decide the minimal remap with tests against current translation and journey consumers, not a new global identity registry. Export does not package WPML/Polylang translations or analytics history.
- Re-run server validation when applying/saving. Browser claims about capabilities, review completion, digests, and normalization are not authoritative.

## Package contract

Introduce a distinct portable-design document. Catalog packs and developer library entries are separate inputs with different trust and product contracts; do not silently accept arbitrary JSON or catalog ZIPs under this feature.

Proposed contents:

```text
design.json
images/<sha256>.png
images/<sha256>.jpg
images/<sha256>.webp
```

The implemented JSON envelope contains a fixed format identifier, package schema version, exporter version, design (name, display format, normalized tree/tokens), image manifest, image bindings, and bounded review notes. The tree declares its own version. Required capabilities are derived from content by the receiving validator; they are not a second editable metadata list. Unsupported schema, vocabulary or capability is refused. Package metadata never enters runtime trees.

Image manifest entries carry digest, verified MIME type, byte size and dimensions; the package-relative filename is derived from the digest and MIME type. Bindings describe the precise image slot: image leaf, root/scoped background, or narrow override. Resolve traversal paths against the validated immutable tree; do not add persistent layout IDs solely for packaging. Exported ordinary links are typed content; arbitrary remote image URLs never become implicit fetch requests.

Do not use exported campaign/template IDs as receiving-site IDs. After direct import, clear the previous registered `template_id`; the campaign owns its snapshot. Keep any original library attribution informational and separate from the registry's identity. Test subsequent layout changes with no registered source baseline, especially Keep my content. Introduce additional provenance storage only if an actual requirement needs it.

Export/import should round-trip supported design content modulo documented transformations: fresh identities, local image URLs, semantic site links, removed product IDs, and any user-approved review choices. Unknown nodes, versions, enums or structural fields must produce a clear refusal rather than disappearing through normalization.

Begin with one supported package schema and the current tree schema. A newer unsupported file produces **Update WConvert to import this file**, identifying the required version/capability when known. Do not build speculative migrations or forward-compatibility shims during the repository's pre-release phase. An old exporter version alone is not a rejection if its declared schema and content remain supported.

## Image handling

Proposed first-release support is PNG, JPEG and WebP, matching the existing verified catalog raster formats. Include both normal image blocks and backgrounds; the catalog's current image-binding helper covers image leaves only and cannot be reused unchanged.

Existing bundled designs include inline SVG art. Preserve it only through a digest reference that resolves to exact art already supplied by the receiving installation; never render SVG bytes just because the file labels them trusted. Derive the lookup from existing bundled data, with no separate authored asset registry. Unavailable built-in art is a specific missing-image issue with an explicit omit-or-cancel choice, not a silent blank. Arbitrary SVG uploads are outside the first release. Do not silently rasterize assets. GIF/video, custom fonts and downloaded resource files likewise need replacement or remain explicit links, not promised embedded content.

Resolve Media Library files, known local plugin assets and installed verified catalog images through server-controlled mappings. A CDN URL is not automatically unsupported if WordPress can resolve its existing local attachment/size; use the local file when available. Never turn a supplied URL into an unrestricted filesystem path. Do not automatically fetch remote images during import or export. For genuinely remote-only or unavailable export images, ask the merchant to select local media or explicitly omit them. Preserve the selected size/crop, not an unrelated original image.

Use WordPress Media Library attachments for committed imported images. This makes them selectable in the existing editor and keeps campaign images from depending on the temporary upload or the source site. Reuse existing WordPress tables/APIs; no new table or column is proposed. Check campaign-management permission for every operation, and media upload permission before staging/importing image bytes. Export alone does not require media upload permission. Respect site-specific allowed MIME types, multisite scope/quota and effective upload limits; do not bypass a host policy because PNG/WebP appears in WConvert's allowlist.

Copy into permanent media only on Apply, after validation and review, using WordPress's sideload/attachment APIs for local staged files. Do not attach images to a post using the campaign's ID; campaigns are not WordPress posts. Name attachments clearly and record only minimal session/ownership data needed for retry recovery. Reuse attachment IDs recorded for this import attempt after verifying their files still exist. A separate later import may create new attachments; no cross-import deduplication index in v1. Preserve per-block alt text in the design even when two blocks share one image with different descriptions; do not repeatedly overwrite shared attachment metadata. Do not write source IDs, full local paths or staged archive contents into public metadata.

On a handled failure before a completed Apply, remove new attachments/files created exclusively by that attempt. Record each created attachment as the operation proceeds so a retry can reconcile partial progress after a timeout; do not promise a database/filesystem transaction across PHP process crashes. Do not delete shared existing media. After a successful Apply, Undo or discarding a draft must not delete images that another draft, published campaign or Redo may use. Imported images remain normal Media Library items; disclose this once in the import dialog. A crash can leave an identifiable unused attachment for manual cleanup. No automatic orphan-media garbage collector in v1.

Staging is short-lived (proposed 30 minutes), opaque, bound to the current user and site, and accessible only through authenticated handlers. Keep JSON and archive bytes outside public access; a random path under public uploads is not sufficient protection. Serve only verified preview raster files through the same authenticated import controller, with private/no-store caching; no new general media proxy. Fetch them using normal REST authentication into browser blob URLs, revoking those URLs on close; do not place authentication tokens in image URLs. Prefer a private temporary directory and refuse the operation clearly if private storage cannot be established. Explicit cancel and expiry clean staging with bounded cleanup on relevant requests and the existing scheduler. Enforce expiration during access even when scheduled cleanup runs late. Expiration asks for the file again and does not alter the draft. Bound active staged sessions/storage per user/site so repeated abandoned uploads cannot accumulate without limit; begin with one active preview session per user/site and explain when opening another replaces it. Never replace a session mid-commit or discard its retry result prematurely; reject concurrent attempts as busy.

## Validation, limits and feature access

Use the manifest and existing journey, form, conversion and capability services as authorities. Extract genuinely shared strict validation from the catalog implementation where appropriate, with separate portable-file and curated-pack policies. Catalog packs currently require empty action URLs and hidden consent; loosening those global rules to accept merchant files would change the wrong boundary.

Proposed initial limits: one design, 256 KiB JSON, 16 unique images, 5 MiB per image, 20 MiB combined images, 4096 pixels per dimension, 25 MiB archive, no more than 17 files, 200 nodes and depth 12. Apply stricter host upload limits and report the effective maximum before upload. Share current journey limits instead of reintroducing a historical two-screen limit. Measure memory/disk bounds with the largest accepted fixture before finalizing these defaults.

Bound archive input bytes, declared and actual expanded bytes, file count and decoder work. Reject traversal/absolute paths, symlinks, nested archives, duplicate names, encrypted entries, executable files, unexpected entries, inconsistent manifests, bad checksums and MIME/dimension mismatches. Do not call unrestricted extraction on untrusted paths. Prefer PHP's ZipArchive for v1; detect it before upload/export and give a clear host-support message if absent rather than shipping a second archive implementation. The plugin minimum is PHP 8.1: use APIs available there, such as getStream after rejecting duplicate entry names, rather than requiring getStreamIndex (introduced in PHP 8.2). Stream and count expanded bytes rather than trusting ZIP directory metadata. Do not raise the plugin's PHP requirement for this feature.

Sanitize filenames and metadata, validate strings/style expressions/URLs and refuse executable or unknown content before any preview. Included images must not cause external requests during preview. No license keys or source-site identity are necessary in the file. Hashes establish integrity, not publisher authenticity or entitlement.

Basic transport is Free. Derive paid runtime requirements from nodes, journey, display format and authoritative capability metadata; never trust an editable `tier: free` field. Do not silently remove paid behavior to make an import fit Free. Explain the missing feature before offering Apply. Missing WooCommerce is a dependency problem, not an automatic Pro upsell. Reuse existing access rules for installed built-in/catalog assets; do not add a new licensing service, signed-file system or provenance-based DRM. A user-supplied file is not proof of catalog entitlement, and a design's original paid branding must not substitute for checking the actual runtime capabilities it uses.

Distinguish strict input size limits from curated-library design lint. `DesignBudget::PER_DESIGN` currently describes an authored-library structural budget and excludes copy; normal merchant drafts may exceed it. Do not accidentally reject a valid editor draft on export solely because the catalog uses a stricter budget. Retain current frontend payload checks and establish the portable draft acceptance policy with representative round-trip fixtures.

## Implementation boundaries

| Existing code | Planned use/change |
| --- | --- |
| `resources/admin/src/builder/OptinBuilder.tsx` | Menu entry points, current-state export, one history action, configuration reconciliation, selection/focus restoration |
| `resources/admin/src/builder/DevExport.tsx`, `entry.ts` | Retain developer authoring use; do not expose its permissive parser as production import |
| `TemplateDesignDetail.tsx`, `PreviewFrame`, `PreviewControls` | Reuse actual candidate inspection, screen navigation, content choices, mobile/desktop controls |
| `templates/api.ts` | Typed prepare/export/import calls and structured review/refusal results |
| `src/Rest/TemplateController.php` | Extract reusable preparation logic if needed; existing snapshot requires a registered library ID and cannot directly prepare a file |
| Proposed `src/Rest/TemplateTransferController.php` | Authenticated bounded export, staged upload, preparation, commit and cancellation |
| Proposed `src/Template/Transfer/*` | Allowlisted exporter, package reader/writer, strict file policy, reference inventory, staged import and media commit |
| `TemplateVocabulary`, `CaptureJourney`, `JourneyGraph`, `CaptureContract`, `ConvertingAct`, `TemplateForm` | Shared semantic validation and identity remapping |
| `SlotRoles`, `PictureTransfer`, `MerchantsOwn`, privacy preparation | Consistent current-content transfer and receiving-site preparation |
| `Catalog/PackValidator`, `VerifiedAssets`, `PackImages` | Reuse/extract bounded validation primitives while preserving catalog policy and storage semantics |
| Container services, REST registration, uninstall/staging cleanup | Register lazily; no transfer processing on visitor or public capture requests |

Proposed authenticated operations under `/wconvert/v1/template-transfer`:

- `POST /export`: validate the submitted editor snapshot and explicit omission choices; return either structured issues or a streamed package. Build the file in temporary storage before sending a successful download response, and clean it afterward. Resubmitting after resolving issues uses the same operation; no persistent export identity.
- `POST /imports`: bounded multipart upload and validated staging; returns metadata and a staging identity.
- `POST /imports/{id}/prepare`: combine current draft, content mode and reference decisions into a reviewed candidate/digest.
- `POST /imports/{id}/apply`: recheck capabilities and candidate freshness, commit required media, return the exact design/configuration patch for one client-side history action. This endpoint never saves/publishes the campaign.
- `DELETE /imports/{id}`: cancel and clear staging.
- `GET /imports/{id}/images/{asset}`: authenticated access to one verified raster in that session; never accept an arbitrary path or URL.

All endpoints use the existing campaign capability gate and REST cookie/nonce authentication, with upload permission where applicable. Nonces do not replace capability checks. Bind import ownership to authenticated user plus site, not a user ID from the request; do not expose source content through logs or error messages.

Server-side preparation holds the canonical candidate in the short-lived session; a client-supplied hash alone is insufficient. Keep only its current preparation and completed-apply result, not a revision history. Use a session lock and a recorded result so double clicks and retries return the same committed media/patch. Disable duplicate Apply in the UI as a convenience, not the sole protection. If the current draft changes while Apply is in flight, do not overwrite those edits; require review against its new revision. Two browser tabs cannot silently take over one another's staged import. This is bounded request retry handling, not a background job or distributed transaction system.

Keep transfer code out of frontend loader bundles and load heavy admin transfer code only when used. Reuse existing admin components and avoid a new top-level settings page.

## Scenario review and expected outcomes

| Scenario | Expected behavior |
| --- | --- |
| Move a normal popup from staging to production | One file, local imported pictures, file content by default; production Goal/settings remain subject to the disclosed compatibility changes |
| Reuse a design on the same site | Same import flow; no site-origin detection, automatic product matching or campaign duplication |
| Import into a campaign that is already live | Only the working draft changes; visitors continue to see its published snapshot until explicit publication |
| Export before saving the latest edits | Export the state captured at click time without saving or publishing |
| Transfer an unfinished offer with no target link yet | Export/import as editable draft; ordinary readiness checks identify the missing action before publication |
| Choose Keep my current content | Preview the actual role-based transfer, including unplaced copy/pictures; do not install discarded file images or review discarded links |
| File contains twenty buttons sharing one old-site URL | One grouped link row shows its uses; one explicit Keep these links action, or edit that URL; no domain guessing |
| File contains a relative URL, a mailto/tel action, or a downloadable PDF link | Use existing supported URL rules. Explain relative links resolve on the receiving site; PDFs remain reviewed links and are not embedded. Do not run a link crawler or send requests to test actions |
| Source site is gone after a successful import | Included raster images continue to work; an explicitly retained external action/resource URL still depends on its external destination |
| Photo uses a CDN URL but its attachment file exists locally | Export the resolved local rendition. If unavailable, list it for explicit omission/replacement instead of fetching the CDN |
| Two image blocks share the same photo but different alt text | One packaged/committed image, two preserved per-block descriptions and crop settings |
| Trusted built-in illustration is unavailable on the receiver | Explain the missing illustration and allow explicit omission or cancellation; reject arbitrary SVG payloads |
| Free site receives a file using a paid question journey | Explain the specific unavailable feature and block Apply; never strip questions to simulate compatibility |
| Pro site receives a Free-compatible file | Import normally; do not introduce a paid requirement based on its source site's edition |
| Product IDs happen to match unrelated products on the new site | No auto-binding; source product selections were removed and must be chosen locally |
| Existing destination mappings happen to use the same submission IDs | Clear form-specific overrides/mappings with notice; keep valid campaign-level connections; Undo restores the whole previous configuration |
| Display format changes or campaign is an A/B variant | Reuse current picker compatibility rules and show required resets/refusals before Apply |
| The uploaded archive is corrupt, too large, or uses a future schema | Clear refusal before preview/media creation; current draft is unchanged |
| Authentication expires, disk fills, or Apply response is lost | Show a retryable error where appropriate; retain draft; reconcile the same session's progress/result rather than duplicating media |
| User cancels, closes the tab, or opens another import | Cancel removes staging; abandoned staging expires. Another preview replaces it only when no commit is running; it never publishes or saves |
| User imports the same file again tomorrow | Ordinary new replacement; new attachments may be created. No deduplication infrastructure or file-version conflict UI |
| User applies and then chooses Undo, Redo, or leaves without saving | History behaves normally; imported media remains in Media Library so Redo/other references cannot break |
| Multisite site switch or different administrator guesses a staging ID | Refuse access; staged data and media commit remain bound to the authenticated user/site |
| ZIP extension/private staging is unavailable or host upload limit is smaller | Explain the specific hosting requirement before work starts where detectable; use the stricter limit without global configuration changes |
| Existing campaign uses translations | Export one authored design, not translation records. Ensure incoming identities cannot accidentally display the replaced design's unrelated translations; explain translation review where applicable |

Only blockers appear as errors. Missing setup that is safe to finish in the editor remains an ordinary readiness item. Keep the routine successful path short; reveal the detailed review list when there is something to act on.

## Delivery slices and acceptance

1. **Contract and representative fixtures.** Define the portable projection, compatibility/refusal codes and image/reference inventory. Fixtures cover popup, inline, backgrounds/narrow overrides, linear capture and Pro branching. A text-only design round-trips without campaign state or unintended field loss.
2. **Complete export.** Deliver editor action through server preparation to downloadable package, with bounded media resolution and explicit omission handling. Unsaved changes export without changing either saved or published state.
3. **Upload and review.** Deliver bounded upload, private staging, strict validation, feature refusal, exact desktop/mobile preview, content choice and reference review. Cancel/failed input leaves the draft intact.
4. **Apply with media.** Deliver idempotent Media Library commit, one undoable draft patch, identity/mapping reconciliation, source-baseline behavior and save/reload. Imported supported pictures work with the source site unavailable.
5. **Hardening and WordPress verification.** Exercise adverse archives, stale candidates, concurrent retries, failures, Free/paid combinations, accessibility and hosting limits. Update docs and validate production builds. Ship only after the complete file-to-draft journey passes.

Slices are implementation steps, not independent promises to ship a partial import/export feature.

## Verification plan

- PHP tests: allowlisted data projection, supported and unfinished-draft round trips, malformed and oversized archives, image integrity, links/site placeholders, capability derivation, unsupported versions, reference remapping, campaign configuration reconciliation, permissions/site isolation, staging expiration, partial failure and retries.
- UI tests: default content mode, candidate re-preparation, file/content errors, no premature mutation, exact Apply candidate, combined Undo/Redo, focus restoration and disabled/busy states.
- Regression tests: catalog validation remains strict; ordinary template selection and Keep my content continue to work after a file import with no library baseline; A/B, privacy, content lock and destination rules remain authoritative.
- Real WordPress exercise across two installs or isolated site contexts: export a draft with unsaved edits and both image/background assets; import on the second; save and reload; disable access to the first site; confirm previews and the published receiving campaign use local pictures. Verify first-site state is unchanged.
- Test format changes and both content modes; verify source product IDs never bind to coincidentally numbered products, and source submission IDs never inherit unrelated destination mappings.
- Test largest supported package, missing ZIP support, PHP 8.1, smaller host upload limits, interrupted media commit and corrupt/stale staging. Verify no public access to staged JSON/archive and no external image requests during preview. Include shared images with different alt text, CDN-to-local resolution, unavailable bundled SVG, mapping/translation identity collisions and repeated Apply with a lost response.
- Run relevant PHPUnit/Vitest suites, PHPStan, TypeScript, ESLint, affected production builds, template/source/artifact checks and loader-budget checks. Broaden only when shared extraction or changed boundaries warrant it. Inspect the dialog in real WordPress at desktop/narrow widths with keyboard navigation.

Completion requires working round trips, local images, predictable review/Undo, unchanged live campaigns until explicit publication, existing Free/paid behavior, and passing checks. Implementation and runtime checks are recorded below; the original planning checklist is not a claim that every hosting fault was simulated.

## Documentation changes at implementation

Record an ADR for merchant file portability, with explicit amendments to ADR 0010's developer-only authoring premise, ADR 0075's content-choice behavior for direct file imports, and ADR 0082 only where shared validation contracts actually change. Update CONTEXT's Template definition and README usage. Preserve the distinction between imported snapshots, registered library templates, favorites and catalog installations.

The plan uses existing WordPress attachments, post metadata and short-lived staging; it proposes no custom database schema. If implementation later requires a new table/column, stop for the repository's explicit storage sign-off with alternatives explained.

## Implementation and verification record — 3 October 2026

Implemented all five slices: lazy editor dialogs, authenticated transfer controller,
strict ZIP codec, private expiring/locked sessions, reviewed candidate preparation,
native image commit with retry checkpoints, one draft history action, and docs.
No new database schema, library storage, third-party service or dependency.

Final simplifications from the proposal:

- Review notices and grouped links share one explicit acknowledgment; missing
  built-in art can be omitted by acknowledging its notice or cancelled.
- Cancel returns to the editor; no redundant Back to editor button in export.
- Capability requirements are derived on read rather than duplicated in the file.
- A design with no registered source identity carries current content on later
  library switches; an unresolved registered source keeps its existing warning.
- Active staging is capped at one session per user/site. Shared image reads coexist;
  exclusive mutations reject a concurrent operation with a retry message.

Verified:

- Full PHPUnit: **2,483 tests, 15,110 assertions passed**.
- PHPStan, TypeScript and ESLint pass. Free and Pro admin builds pass.
- Source contract and all loader/phone budget checks pass. Artifact contract unit
  tests are included in PHPUnit; no release ZIP was published.
- Final frontend run with two workers: **3,557 passed; 26 pre-existing failures**.
  The unchanged HEAD (`ea08c34`) reproduces all 25 stylesheet inventory failures
  and the mobile-scope text assertion. New transfer tests and updated campaign
  menu tests pass. The PR must not be represented as having a green full suite.
- Two disposable WordPress Playground installs with **PHP 8.1**: browser export,
  cross-site import, desktop/mobile preview, link edit/review, Apply, one-step
  Undo, and normal Save/reload with the reviewed link and local images. The source server was stopped before the receiving import was applied.
- Real REST checks: no media creation during preview; stale digest and unreviewed
  apply refused; a repeated Apply returns the same patch and creates one image;
  no campaign persistence/publication from Apply; receiving-site media URLs;
  cancelled sessions and a malicious ZIP refused without campaign changes.
- A package with five valid PNGs (**19,673,515 expanded image bytes**) was uploaded,
  prepared and committed through WordPress PHP 8.1, producing five attachments.
  The codec alone peaked at **43,679,744 bytes** under a 128 MiB PHP limit. This is
  a representative near-total-limit measurement, not a universal hosting guarantee.
- Unit regression coverage includes malformed/future/oversized documents, unsafe
  style/link data, explicit image omission, shared image/alt text preservation,
  Free refusal of paid journeys, two-submission graph transfer, invalid references
  after unfinished follow-up links, fresh internal references, receiving settings,
  content preservation without provenance, session ownership/replacement/expiry,
  concurrent read locks, repeated link edits, cancellation and retry results.

Remaining release verification: multisite quota/MIME-policy combinations,
forced disk-full/media-service failures, and PHP process termination between
attachment insertion and checkpoint. Their code paths are bounded and fail closed,
but those host-level failures were not injected during this implementation.
Successful imported media intentionally remains after Undo or discarding a draft.

## Best-practice references checked on 3 October 2026

- WordPress requires endpoint permissions to be checked for the authenticated user; follow the existing capability gate and validate request arguments. [Adding custom endpoints](https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/).
- WordPress nonces protect against CSRF but are not authorization or single-use transaction tokens. Session ownership, capability checks and retry state remain separate. [Nonces](https://developer.wordpress.org/apis/security/nonces/).
- Use native attachment creation for verified local staged files rather than implementing a parallel media store. WordPress's helper returns an attachment ID or WP_Error and generates attachment metadata. [media_handle_sideload](https://developer.wordpress.org/reference/functions/media_handle_sideload/).
- Use bounded entry streams on the project's PHP 8.1 baseline. [ZipArchive::getStream](https://www.php.net/manual/en/ziparchive.getstream.php) predates PHP 8.1; [getStreamIndex](https://www.php.net/manual/en/ziparchive.getstreamindex.php) requires PHP 8.2 or the corresponding newer extension. The plan's archive validation limits are our design choices, not guarantees supplied by these APIs.

### UI refinement — 2026-10-03

Import starts with a compact file chooser and drag-and-drop target. After upload,
a desktop preview remains beside the file identity, content choices, notices and
link review. The layout stacks on small screens; the action footer stays visible.
Both dialogs initially fit the entire design and retain desktop/mobile, screen
and result controls. Export now previews the current draft beside an inclusion
summary and explicit unsupported-image omissions. Errors and in-progress actions
have distinct messages. A refused replacement file returns to file selection
instead of offering to retry its already-cancelled predecessor.

Verified in real WordPress on PHP 8.1 at desktop and 390px phone width: choose
file, preview, edit/review links, Apply to draft, and download the unsaved design.
The original 83 focused UI tests passed; two additional regression cases cover
explicit export omissions and refused replacement files (all six transfer tests
pass). TypeScript, targeted ESLint, and Free/Pro admin builds pass. The earlier
full-suite baseline failures remain outside this UI refinement.
