# 0132: Every screen answers its first question

Date: 2026-10-09. Status: accepted.
Amends [0112](0112-template-discovery-and-reviewed-collections.md),
[0087](0087-choices-first-details-on-demand.md) and
[0035](0035-the-admin-owns-its-page.md). GUIDELINES §§9, 20 carry the rules.

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
4. **A row menu holds actions on that row.** Check visibility explains every
   campaign on a page, so it is the list's footer link ("Why isn't a campaign
   showing?"), replacing a third copy of the Visitor experience link.
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

## Consequences

- ADR 0112's "inspection is the sole creation-card action" now has one
  exception, the Start here card, and comparison can create a draft.
- `SetupIndex` no longer sends the inline placement sentence; the client lists
  it with the other to-dos, so comparison shows what differs (format, timing)
  instead of two identical lists.
