# 0149: An occasion groups campaigns

Date: 2026-10-17. Status: accepted.
Amends [0112](0112-template-discovery-and-reviewed-collections.md) and the
[[Site occasion]] entry in `CONTEXT.md`. Records the vocabulary #273 builds on.

Until now a [[Site occasion]] was a name and an inclusive date range kept for
planning. It suggested ideas in the design picker and stored nothing that could
reach a visitor. #273 asks for one campaign (Black Friday, a launch) that is
defined once and shows a top bar, a popup and an inline banner between its
dates. The merchant needs one place that holds those three Optins together.
The occasion already has the name and the dates, so it becomes that place.

## Decisions

**1. An occasion is a folder that owns campaigns.** "Campaign" still means one
[[Optin]]. An occasion does not replace it and is not a second kind of
campaign. A campaign belongs to at most one occasion. The list can show one
occasion's campaigns, and group actions (#278) work on that view like any
other.

**2. No phases.** Each campaign keeps its own `starts_at` and `ends_at`
(`Schedule`, ADR 0050). A "coming soon" teaser and the live offer are two
campaigns in one occasion with two windows, not two stages of one record. We
rejected stored phases because they add a second schedule beside the one the
loader already enforces, and the two would disagree.

**3. Creating a campaign inside an occasion prefills its schedule.** An
occasion's dates are inclusive `Y-m-d`. A campaign's end is exclusive, so the
prefill is:

- `starts_at` = the occasion's start at `00:00`;
- `ends_at` = the day after the occasion's end at `00:00`.

Both are wall times in the site's timezone, the only form `Schedule` stores.
Black Friday 20 Nov – 1 Dec becomes `2026-11-20 00:00` to `2026-12-02 00:00`,
so the campaign shows all of 1 Dec. The prefill is a starting value. The
merchant may change it, and changing the occasion's dates later moves no
campaign.

**4. No schema change.** The occasion stays in the `wconvert_picker_occasions`
option (ADR 0112). A campaign links to it with an `occasion` key in its
existing `config`, holding the occasion's id. No table or column is added.

  *Completed in #276: `OccasionLink` checks the link on every save. An unknown
  id is refused with 400 `wconvert_optin_unknown_occasion` on the `occasion`
  field. The list reads the id with `JSON_EXTRACT` in its projection, so it
  still never selects the `config` blob (ADR 0001). Copy, export and import
  are [ADR 0153](0153-an-occasion-travels-as-one-document.md).*

**5. Deleting an occasion detaches its campaigns and never deletes them.** A
campaign whose `occasion` names a missing id reads as belonging to no occasion.
Nothing is published, paused or removed as a side effect.

  *Completed in #276: the detach happens on read, and deleting writes no
  campaign. The list and `GET /optins/<id>` drop an id that names no existing
  occasion. The campaign's next save hands that id back, and `OccasionLink`
  drops it instead of refusing it, because only the id the campaign already
  held is dropped this way. So no write fans out across campaigns, and the
  route stays the only thing that edits one.*

**6. An occasion never schedules or publishes anything by itself.** Publishing
is still a per-campaign act. The occasion's dates are only the prefill in 3,
never a rule the loader reads.

**7. Agents read and draft; publishing needs a setting.** An agent may list
occasions and campaigns, and create draft campaigns inside an occasion.
Publishing, scheduling or pausing a campaign is refused unless a site
administrator has turned on "Let AI agents publish". The setting is per site
and off by default.
