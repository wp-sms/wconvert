# The library helps merchants compare before applying

The [flow-by-flow review](../reviews/2026-09-10-flow-by-flow-ux.md) starts from
WConvert's purpose: help a WordPress business attract a visitor, capture useful
details, and hand them to an optional plugin or service. A merchant choosing a
ready-made design needs to find a suitable form and inspect its behavior before
replacing work in the editor.

The previous gallery searched names only, hid filters in smaller libraries,
offered empty layout choices and treated Email + Phone as either field. Its
cards showed only the first screen before applying. The WordPress review also
found a real image background excluded from “With a picture” and keyboard focus
entering sample preview content.

This decision changes the gallery and its handoff to the editor. The review's
other proposals are not adopted here. Publishing and destination setup are
subsequently addressed by [ADR 0070](0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md);
capture fields and report navigation remain separate work.

## Find designs by what they actually offer

The Optin's Display Type remains the library's fixed scope. Identify that scope
so the merchant understands which designs are being counted; browsing does not
change a popup into an inline Optin. Search and relevant filters remain available
in every nonempty library, regardless of its size.

Search matches design names and localized, derived features: collected fields,
layout, imagery and the converting act. It uses the existing index and label
vocabulary. It introduces no Goal, industry, campaign or season taxonomy, and
does not fetch every tree just to discover filters.

The primary choices are an optional **Fill in a form / Follow a link** selection,
**Must include** fields, and **With a picture**. Layout and site availability
are secondary choices. Nothing is preselected from the Goal. This amends the
act-not-a-filter wording in [0043](0043-the-library-is-indexed-and-its-facets-are-derived.md)
and [0059](0059-the-converting-act-belongs-to-the-design.md), while preserving
the latter's design-act, history-warning and A/B compatibility rules.

- Selecting Email + Phone requires a design with both fields: AND within captures.
- Selecting multiple layouts accepts any selected layout: OR within layout.
- Different groups, search and site availability combine with AND.
- Counts retain search and other active constraints. A field count includes the
  other required fields; a layout count measures that specific alternative.
- Values absent from the current format are omitted. Zero-result combinations
  are disabled unless selected; selected choices stay removable. Active filters,
  Clear filters and the matching count make the current result understandable.

Picture metadata includes image blocks and actual image URLs in backgrounds the
renderer paints, including supported responsive overrides. Gradients and unused
background tokens do not count as pictures. The server still derives this once
when indexing an installed design; no authored picture flag or visitor payload
is added.

## Inspect, then apply

A ready design card opens a detail view in the same library dialog. It shows
Desktop/Mobile previews, every actual screen in the design, collected fields and
the converting act. The preview uses the existing renderer. Under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md),
it shows the normalized result of Keep my content or Use this design's sample
content. Forms and links are inert to both pointer and keyboard interaction.

The detail preview preserves the chosen layout width and fits it visually into
the available stage without changing the responsive layout to match a narrow
dialog. Full-width designs need a stated desktop reference viewport; it is a
comparison preview, not a claim to reproduce every site's final placement.
Tall designs remain scrollable. Mobile preview is a mobile layout, not a shrunken
desktop screenshot.

Mark preview wording with the selected content mode. **Keep my content** remains
the default; **Use this design's sample content** is now available under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md).
Beside **Use this design**, explain the replacement scope. Prepare the normalized
candidate through the existing snapshot endpoint before enabling Apply, then
apply that exact preview in one draft Undo entry. A mode change hides an obsolete
candidate; failure and Retry remain local, and Back/Close write nothing. No extra
confirmation dialog, database schema or migration is introduced.

Compatibility reasons and an act-change warning remain visible before applying.
Inspection does not waive a refusal. Locked metadata cards keep their existing
external **See this design** path; they gain no bundled premium tree or invented
interactive preview.

Back returns to the same query, filters and scrolled results. Focus enters the
detail heading, returns to the card on Back and returns to the library trigger
when the dialog closes. The hidden browse surface cannot remain in the keyboard
path. Escape retains the dialog's close behavior.

## Loading belongs to the preview that failed

Keep viewport-based preview loading and rendering. Coalesce requested ids and
split batches into at most 24 trees, matching the existing server cap. Successful
previews remain available if a sibling request fails.

A failed request or a requested id omitted from a successful response produces
a local failure state with Retry in the card/detail. It must not remain an
endless skeleton or repeatedly retry when scrolling. This is separate from the
future optional remote catalogue source's silent fallback to bundled designs in
ADR 0043; an installed preview that cannot load has a useful repair action.

## Verification boundary

Check field intersections, layout alternatives, counts, feature search and
picture derivation against the real catalogue. Exercise local errors, retry,
request chunking, preview screens, narrow widths, keyboard navigation and Back
state preservation. Review the shipping components in WordPress as well as
fixtures. This work neither sends test leads nor establishes provider delivery.
