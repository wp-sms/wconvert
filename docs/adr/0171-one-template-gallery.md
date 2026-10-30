# 0171: One template gallery

Accepted 2026-10-25. Amended by [0175](0175-the-online-library-loads-without-asking.md) (§9). Amends 0026, 0039, 0043, 0069, 0085, 0086, 0087, 0112, 0116, 0132, 0134, 0137, 0147, 0156 §8–9, 0163 and 0170.

The approved prototype (v5, 2026-10-24, branch `prototype/template-gallery`)
replaces the creation flow's step 2 and the editor's design picker with one
gallery of templates. This ADR landed with the slices that built it: the data,
step 2, then the editor.

## One answer for step 2

`GET /playbooks?goal=` returns `{setups, online, library}` instead of a bare
list (`src/Discovery/GoalGallery.php`):

- `setups`: this site's setups for the Goal, `SetupIndex::entry` plus the
  recommendation, in `FlagshipCollection` order, each with its design's
  `facets` and `tier` so the gallery can filter and label it.
- `online`: the catalogue's setups for the Goal that this site does not have,
  each joined to its design card for `facets`, the 600w/1200w `thumbnail`,
  `display_type`, `tags` and `preview_url`, and carrying the catalogue's
  `state` (unavailable → locked → update_plugin → install). A `locked` row is
  sent only where `ProHints::shown()`, exactly as the design index does. A row
  already installed is not sent, and nor is one whose id is a setup this site
  ships with: the bundled setup is that card, drawn live (two cards under one
  key left the bundled one without its tree). One installed at an older
  revision names the Playbook it left (`installed_playbook_id`) so the gallery
  shows one card, offering the newer revision only when it can be installed.
  Nothing is sent until consent is `yes` *(amended by [ADR 0175](0175-the-online-library-loads-without-asking.md): consent is
  `yes` unless Settings turned the library off)*. Pro is one plan (ADR 0146), so
  nothing is locked on a Pro site and the gate is `ProHints::shown()` alone.
- `library`: `{configured, consent, checked_at}`, so the gallery can ask once
  *(no longer — [ADR 0175](0175-the-online-library-loads-without-asking.md))* and tell whether its own refresh brought a newer list.

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
not offered unless it is selected (GUIDELINES §20).

## What the picker stops remembering

Markets, preferred businesses, event opt-outs and the country suggestion are
gone (amending 0112). A seasonal collection shows inside its window wherever
the shop is, collections order by priority, and Business is a gallery filter
rather than a preference. Picker preferences keep `saved`, `hidden` and
`show_featured`, still in user meta; only their keys shrink. No table changes.

## Step 2 is the one gallery

1. **One grid** holds bundled, installed, online and locked templates. Using
   an online card installs it silently, then creates the draft from the
   Playbook it became (just installed, it was never previewed, so there is no
   revision to hold it to); a failed install says so on the card with Try again.
   A card with a newer revision offers "Get the newer version" instead.
2. **The UI word is "Template"**: "Choose a template", "Use template", "No
   templates match". Domain terms in the code do not change: a Playbook is
   still a Playbook, shown as a template.
3. **Each card** is the stage (ADR 0170), the name and ★, one row of chips —
   format, what it asks for (Email, Phone, Name, or Button for a click design),
   and Recommended or a grey lock with the plan's name — and one action: Use
   template, See this design ↗ for a locked card, or an amber note when the
   site cannot use it.
4. **The collections shelf** sits on top. A tile filters the grid; When
   (only the stages that collection has) and "Show all templates" appear in a
   bar while it is open. Each tile can be hidden; the shelf can be hidden and
   shown again. A seasonal tile counts the days while its event is two weeks
   away or less ("In 6 days", "Tomorrow"), then says "Until …" or "Ends today".
5. **On Free with Pro hints**, locked cards are mixed in where they fall in
   recommended order, Format names Pro-only formats "· Pro", and a Plan strip
   (All/Free/Pro) appears. Pro goals stay hidden.
6. **One toolbar row**: search, Format, Plan, More filters (Asks for,
   Business, Saved) and the count; a filter More filters holds is also a chip
   that removes it, with Clear filters at two or more. There is no sort.
7. **Removed**: Start here, Compare, "Works with this goal", the ⋯ menu,
   "Online setups" and "Occasions & preferences". **New occasion** moved to
   the Campaigns ⋯ menu beside Import occasion.
8. **The goal step stays**; step 2's header carries a goal switcher. A
   campaign created from an occasion opens the seasonal collection whose event
   overlaps the occasion's days, at the stage the occasion is in. A new
   occasion saved from the Campaigns ⋯ opens its page, where campaigns are made
   for it.
9. **The consent card** asks at the end of the grid — "See more templates from
   the WConvert library?" — with no count, because nothing is fetched before
   the answer (a departure from the prototype, which showed one). *Removed by
   [ADR 0175](0175-the-online-library-loads-without-asking.md): the library is on by default and the first open fetches.*

10. **Step 2 checks the library too.** Once the gallery is read with consent
    `yes`, step 2 sends the same `refresh` with `if_stale` that opening Change
    template does — a no-op inside twelve hours — once per visit, since the
    library is the site's and not the goal's. When `checked_at` comes back
    changed, the gallery is read once more; when it does not, nothing is. The
    previews already fetched are kept: a refresh changes the online cards, and
    a local setup whose revision moved is fetched again anyway (resetting them
    re-downloaded a whole page, ~4.7 MB on a photo-heavy site). A failure (the
    server's five-minute backoff, `WP_HTTP_BLOCK_EXTERNAL`, the twenty-second
    budget) says nothing: the saved list stays the answer. A 304 also moves
    `checked_at`, so the first visit after twelve hours re-reads the gallery
    even when nothing changed — one GET, no previews.
11. **A page's trees are one request.** The page's local cards, and in step 2
    the shelf's covers, are asked for together as soon as the page is drawn;
    `useSetupPreviews` and `useTemplateTrees` batch a tick, inside the routes'
    24-id cap (a page is 24 cards, so only covers beyond it make a second
    request). The stage still draws only near the viewport (ADR 0170 §7).
    Before this, each scroll moment made its own request of one to three. Only
    the plugin's local preview routes are asked, so the catalogue's design
    downloads, and its counts, are unchanged. An online card asks for no tree
    at all: it is the catalogue's picture, and asking the trees route for its
    id failed and covered the picture with "Preview could not be loaded."
12. **An online card whose picture cannot load says so.** A site offline, or
    blocking outgoing requests, still lists online cards from its saved status,
    but their pictures fail. The stage keeps the ghost page and says "Picture
    unavailable offline" (no words on a thumb); the card's action is unchanged
    and says its own error, with Try again, if it is used.

Inspection is a larger look at one card: Desktop/Mobile, Fit/Actual size, its
screens, its gist and the same one action. The setup facts list that lived
there is gone with the prototype; the editor shows what a draft needs.

## The editor's Change template is the same gallery

The editor's design browser, its own grid, card, toolbar and comparison, is
gone. Look's **Change template** opens the gallery above, one card per design
(`mergeDesigns` over the template index), titled "Change template" and saying
"Your words, rules and placement stay. Only the design changes."

1. **A "Show" select after Format**: "For “goal”" by default, the designs that
   fit the campaign's Goal, or "All templates". Under All templates a design
   the form switch would convert carries its chip and action — "Email form
   added", "Use with email form" (ADR 0163). The fit filter is the editor's
   alone; creation's templates are already the goal's.
2. **The template in use comes first**, marked "Current template", with no
   action; then the ones that fit, then the index's order. "For “goal”" is a
   filter like the others, so the count still says how many templates there
   are ("3 of 50"). Format starts at
   All formats, as the prototype does; picking a template in another format
   says "Switch to …" in its review. Each opening starts unfiltered.
3. **More filters adds the editor's extras**: the library's Industry, Occasion
   and Style, Layout, and With a picture, each a chip when on.
4. **Use template opens the review** — keep my words or the sample's, what
   changes, the refusal if this Optin cannot take it — and only the review's
   button replaces the design, undoably. *Clarified by #372: Keep keeps your
   words where the new design's screens match yours and fills every other
   slot with the design's own words, except a figure, code, rating, brand or
   address, which stays for you to add (`SlotRoles::fillBlanks()`). Quiz
   questions, answers and result rules come from the template; when both
   designs ask questions the review says "This template brings its own
   questions. Yours will be replaced."* The grid stays mounted under it, so
   Back returns to the same card and scroll. An online card installs first,
   then opens the same review; Get the newer version does the same with the
   newer revision; a failed install is said on the card with Try again.
5. **A refusal is said in the review, not on the card.** The cards were
   already preview-first: what this Optin would refuse is read beside the
   button it disables.
6. **The format picker's Pro hint is gone** (ADR 0147 is amended): a format
   only locked cards use is "· Pro" in Format, and the locked cards say the rest.

The UI word is "template" through the review as well: "Use this template",
"Current template", "Back to templates".
