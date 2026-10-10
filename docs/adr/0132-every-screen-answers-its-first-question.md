# 0132: Every screen answers its first question

Date: 2026-10-09. Status: accepted.
Amends [0112](0112-template-discovery-and-reviewed-collections.md),
[0087](0087-choices-first-details-on-demand.md),
[0035](0035-the-admin-owns-its-page.md),
[0086](0086-campaign-setups-explain-handoff-and-format.md) and
[0129](0129-display-rules-plain-questions-and-quick-picks.md). GUIDELINES §§9, 20 carry the rules.

[0131](0131-one-way-to-show-each-thing-in-the-admin.md) made every screen draw
the same thing the same way. This review asked the next question of each
screen and dialog, for a first-time shop owner and a daily returning user:
is the thing they came for the most visible thing, with one way forward?

## Decisions

### Campaigns
1. **One primary action, even when empty.** An empty list carries the Create
   button; the page header drops its copy until a campaign exists.
2. **A filter that would filter to nothing is not offered.** Status chips are
   All, the statuses in use and the selected one.
3. **A count is read against what it is out of.** A row's result adds its rate
   and how often it was shown; "Most results" sorts by it.
4. **A row menu holds actions on that row.** Check visibility left the row
   menus; after review the owner removed the list's door to it too, and the
   list's foot is one line: the count, the dates and the pages (amends
   [0048](0048-the-eligibility-inspector-runs-on-the-real-page.md)).
5. The owner chose not to add a "Today" line to Campaigns.

### Create a campaign
6. **Start here.** Past three setups, the first recommended one this site can
   use is drawn wide above the gallery with Use this setup and Preview first.
   It disappears as soon as the merchant searches, filters or sorts.
7. **Two toolbar rows.** Search, sort and a ⋯ "More ways to browse" menu
   (collections, template packs, occasions & preferences); then format chips,
   a compact More filters toggle and the count. Featured collections follow
   the setups. Business stays a More filters select (owner's choice).
8. **A setup at a glance.** The detail shows one icon line per fact (format,
   opens, where, who, how often, counts) and an open **Have ready** list of
   what the merchant must bring. The server lists the Goal's publication rule
   only when the design does not already meet it.
9. **Creation is an address**, `#optins?new=1`. Change goal sits in the step's
   header; "Choose a design myself" replaces "Start with a blank draft", and a
   draft with no design opens the design library straight away.
10. Setups whose design is missing are hidden from creation, as
    `renderingFor(…, 'creation_flow')` always said; a paid install's premium
    pack is labelled with its tier, not a lock.

### Editor
11. **A first list campaign can publish.** With no ready service of the Goal's
    channel, creation writes `capture_mode = local` (amends
    [0086](0086-campaign-setups-explain-handoff-and-format.md)); where the
    blocker still appears, its answer is a button beside it.
    *Amended by [0133](0133-a-fresh-setup-has-nothing-to-fix.md): creation
    writes nothing; a missing mode with no Destination bound reads as local on
    both sides, for every Goal.*
12. **Blockers say how many and where.** Review & publish reads "N to fix"
    (described, not renamed), each tab holding a blocker carries a dot, and
    after jumping to one a "Back to review · N left" chip stays in the header.
13. **Opening is held at Right away** while automatic inline placement or a
    content lock is chosen, instead of failing at publish (amends
    [0129](0129-display-rules-plain-questions-and-quick-picks.md)).
14. **Success says what visitors get**: "It's live" and one where · who ·
    when line; "Check your site" replaces "Check your homepage" when the
    rules name pages.
15. **The header never reads Published over a suspended or trashed campaign.**
    "Draft saved" stays (owner's choice).
16. Edit view drops Find (Flow keeps it) and folds More screen options into a
    ⋯ (*since [ADR 0134](0134-one-edit-tab-look-screen-element.md), into the tree's one **+ Add screen** menu*); "Let answers
    choose the next screen" replaces "Enable flexible paths".
    The Design tab's "Edit screens & conditions" duplicate is gone.
17. The design library toolbar matches creation's two rows; a colour drag is
    one Undo step; a deleted layer shows its own Undo; Campaign details says
    Results and carries the developer ID disclosure.

### Settings
18. **Settings opens where setup starts**, Connections & destinations, with
    destinations before accounts; one "Connect an account" menu, and a
    successful connect leads into adding that destination. A destination is a
    compact card; its settings and recent sends open in dialogs (owner's ask).
19. "Find a setting" lists settings, not categories, and focuses the control.
    Phones get one category select instead of a 450px rail.
20. Cancel appears only when a section has changes; Data & privacy leads with
    retention (with 30/90/180/365-day presets); Analytics integrations shows
    only its switch while off. The display cap's wording says it is for ever
    (a period is deferred to its own change); phone input suggests a default
    from the store address or site language, computed on read, nothing stored.

### Leads and Analytics
21. **One date control** (`shell/DateRangePicker`): a button naming the window
    and its dates, opening presets (Today, Yesterday, Last 7/30/90 days, This
    month, Last month) as native radios, Custom dates, and whatever qualifies
    the window (Analytics' comparison). It replaces the Leads period select
    and Analytics' period select and date-scope card.
22. Analytics accepts a custom `from`/`to` window (validated, ≤366 days, never
    past the site's today) and a labelled live Today; every other preset stays
    complete-day (amends [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md)).
    A custom range is complete only when it ends before today and is compared
    with the same number of days before; every report route (`ReportWindow`)
    reads the same window, and the dashboard payload carries the site's
    `today` so months and the picker's limit never come from the browser.
23. A submission shows "Not sent" from the existing failure ring — never
    "Sent" (ADR 0008) — and Sending issues leads with a verdict and counts.
24. Goal cards add rate and change; stores with sales tracking get a Linked
    sales hero card; A/B reports state the difference and whether there is
    enough traffic, never a winner; monthly targets say whether they are on pace
    (amends [0090](0090-monthly-targets-are-optional-benchmarks.md)). An impact
    card with no goal, count or previous count is not drawn, on any site
    (generalises [0127](0127-free-keeps-product-seams-not-product-reads.md)'s
    cart rule); "Sending needs attention" comes before the numbers; "Today’s
    activity appears tomorrow." is the one wording of that fact.

### Shell and blocks
25. **Polish after review:** inline disclosures keep their chevron beside the
    words; More filters opens one inset panel with captioned fields; a
    measure's amount and unit are one joined control under its slider; the
    editor's preloader is the editor's own frame; Data & privacy's data map is
    closed by default; the Needs attention card leads with what is wrong and
    puts the fix and its evidence on one row.
26. Help holds help (Getting started, Guides, Contact support, What's new);
    the bell shows a count and says "Everything is running" when it is, and
    counts forms paused by spam protection; reading-page headings are tighter.
27. The blocks are "WConvert campaign", "WConvert content lock" and "WConvert
    lock from here"; the inline block lists drafts as refused choices, links to
    create, manage and edit, and copies its shortcode — the shortcode is a
    second place a campaign ID may appear (amends 0131 decision 4).

## Consequences

- ADR 0112's "inspection is the sole creation-card action" now has one
  exception, the Start here card, and comparison can create a draft.
- `SetupIndex` no longer sends the inline placement sentence; the client lists
  it with the other to-dos, so comparison shows what differs (format, timing)
  instead of two identical lists.
