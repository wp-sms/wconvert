# 0171: One template gallery

Accepted 2026-10-25. Amends 0112.

The approved prototype (v5, 2026-10-24, branch `prototype/template-gallery`)
replaces the creation flow's step 2 and the editor's design picker with one
gallery of templates. This ADR lands with the slices that build it; this
section records the data the gallery stands on.

## One answer for step 2

`GET /playbooks?goal=` returns `{setups, online, library}` instead of a bare
list (`src/Discovery/GoalGallery.php`):

- `setups`: this site's setups for the Goal, `SetupIndex::entry` plus the
  recommendation, in `FlagshipCollection` order, each with its design's
  `facets` so the gallery can filter and label it.
- `online`: the catalogue's setups for the Goal that this site does not have,
  each joined to its design card for `facets`, the 600w/1200w `thumbnail`,
  `display_type`, `tags` and `preview_url`, and carrying the catalogue's
  `state` (unavailable → locked → update_plugin → install). A `locked` row is
  sent only where `ProHints::shown()`, exactly as the design index does. A row
  already installed is not sent; one installed at an older revision names the
  Playbook it left (`installed_playbook_id`) so the gallery shows one card.
  Nothing is sent until consent is `yes`.
- `library`: `{configured, consent}`, so the gallery can ask once.

Online setups carry `business_types`: the publisher emits a setup's Playbook
examples on its index row and `CatalogIndex::setup()` reads them, a missing
value meaning none. The setup objects themselves are unchanged, so no object
revision moves.

## One card model

`resources/admin/src/gallery/model.ts` turns that answer (`mergeSetups`) and
the design index (`mergeDesigns`) into the same `GalleryCard`. Recommended
cards come first and the server's order stands otherwise; a locked card stays
where it falls — nothing sorts the usable ones first. `filterCards` and
`optionCounts` are the gallery's filters: an option that would match nothing is
not offered unless it is selected (GUIDELINES §20). `fieldChips` names what a
card asks for — Email, Phone, Name — or Button for a click design.

## What the picker stops remembering

Markets, preferred businesses, event opt-outs and the country suggestion are
gone (amending 0112). A seasonal collection shows inside its window wherever
the shop is, collections order by priority, and Business is a gallery filter
rather than a preference. Picker preferences keep `saved`, `hidden` and
`show_featured`, still in user meta; only their keys shrink. No table changes.
