# Installed packs supply campaign starting points

ADR 0082 installed designs but left campaign wording and rules in bundled
Playbooks. Installing a collection could not add a complete starting point to
the existing goal-first creation flow.

## One creation path

Packs can now carry an optional `playbooks` list, declaring `campaign-starts:1`.
These are JSON data. Installed entries join the existing PlaybookLibrary and
Prefill; no second campaign builder or snapshot mechanism is introduced.

Choose a goal, then Browse template packs (*the button reads **Template packs** since [ADR 0131](0131-one-way-to-show-each-thing-in-the-admin.md)*), preview and install a collection.
**Amended by [ADR 0127](0127-free-keeps-product-seams-not-product-reads.md):**
that button appears only once a catalog service is configured.
Choose a starting point returns to that goal's creation gallery filtered to the
collection. Cards show the real Prefill composition and effective setup facts. **Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** the index is metadata-only; bounded visible-card requests prepare actual previews. Canonical design grouping follows active filters, and source/prepared revisions protect creation after inspection. Reviewed discovery Collections are separate from delivery packs.
Only Customize this starting point creates a draft; the editor continues to own
review and publication. Merely installing or choosing a collection creates no
Optin. The design picker still changes designs only, and explains which campaign
starts the pack includes.

Installed starts carry their collection name/version in the creation response.
IDs and template references are namespaced by immutable package digest; they
cannot overwrite a bundled entry. Only the latest installed release supplies
new starts. Existing Optins keep their own design, copy and rules. Older template
baselines stay addressable, while a removed starting point is not resurrected
from an older pack version.

## Remote data boundary

The existing archive, hash verification, explicit requests, compatibility gates,
size limits and offline behaviour remain. No table or column is introduced.
A pack declares at most twelve starting points, each referencing a design in
that same pack. Unknown fields, Goals, roles and references are refused before
installation. Registration uses the existing Playbook refusal rules without
emitting author warnings for remote validation failures.

Copy follows the actual Slot Role bindings, including repeated paragraphs,
policy-link labels and choice options. The 1 October publisher check corrected
screen-scoped copy validation: use the existing SlotRoles scope mapping, then
validate each screen's own roles and values. Valid multi-screen setups no longer
trigger an undefined `screens` binding; unsafe scoped wording remains refused.
See [ADR 0112](0112-template-discovery-and-reviewed-collections.md). Extra or unsupported properties, markup,
URLs and merchant-owned coupon codes are refused. The bound tree passes the
same placeholder-only node checks as a downloaded design.

Rules are read against the shared manifest: Free client rules and portable page
rules only, with at most twenty per list and explicit parameter validation.
This first capability accepts seconds, percentages, device sets, post types and
path globs. Targeting supports include/exclude page lists and a boolean logged-in
flag. Other controls, premium rules, authored parameters, role memberships and
unknown settings are refused; unsupported data is never silently dropped.
Destination hints contain type/field names only and never bind a connection.
Frequency and real schedules remain merchant setup, as in the bundled Playbooks.

## First local release

Version 1.1.0 of the store, publisher and service collections adds ten existing
reviewed starting points alongside the same ten designs. Both design JSON and
bundled Playbook PHP source fingerprints are pinned by the build definition.
The build reads trusted local PHP only, emits validated JSON, and preserves all
previous package bytes. Cart-dependent and image-embedded examples remain out
of this Free, placeholder-only slice. Hosting, paid fetching and media imports
remain separate work.

See [verification](../reviews/catalog-campaign-starts-2026-09-14.md).
