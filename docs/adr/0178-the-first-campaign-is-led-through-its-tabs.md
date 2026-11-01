# 0178: The first campaign is led through its tabs, and Review names its defaults

Accepted 2026-11-01. Amends [0138](0138-one-preview-one-review-one-details.md)
decision 4 (How it runs). Extends [0176](0176-a-new-site-is-guided-to-its-first-lead.md)
(it reads the `first_publish` milestone).

## Context

A tester's first users published without ever opening Display rules or
Destinations. Review & publish only linked back to the rule sections, its
"Leads go to" row had no link, and nothing said which values were simply
WConvert's starting settings.

## Decisions

1. **Every How it runs row in Review is a link** to the tab that changes it,
   "Leads go to" included (Destinations). "Back to review" stays on screen
   after any jump from Review, not only after a blocker, until Review is
   reopened. Nothing is edited inside the dialog
   ([0131](0131-one-way-to-show-each-thing-in-the-admin.md): no stacked dialogs).
2. **A "Default" tag marks a value still on WConvert's starting setting**, the
   one "Start from scratch" writes: Who "Everyone", Where the entire site,
   Opens "Right away", How often once per visit (`maxPerSession: 1`,
   `stopAfterDismiss: false`), and leads kept in WConvert (`capture_mode`
   local). It is a muted, neutral tag beside the value, with one line under the
   list: "Rows marked Default use WConvert's starting settings." It describes
   the value, not whether anyone looked, so it needs no state: a Playbook's
   rules are tagged only where they equal the default, and a value kept on
   purpose is still tagged. A row that needs attention shows its problem, not a
   tag. Review only; Campaign details shows no tags.
3. **Free never tags "Leads go to".** Outbound Destinations are Pro, so Free has
   nowhere else to send them and the tag would only nag. The link stays.
4. **Until the site's first publish, the header leads through the tabs.** Its
   primary button reads "Next: Display rules", then "Next: Destinations", then
   "Review & publish", skipping any tab already opened for that draft — by a
   click, an issue's link or `?tab=rules`. The tabs stay free; Next only
   changes where the button goes. The fact is the existing `first_publish`
   milestone, handed to the page as `firstPublished` and set in the page after
   a publish; no new option. The milestone is never cleared, so deleting every
   campaign later does not bring Next back.

## Consequences

- At most two extra clicks, once per site. Reopening a draft before the first
  publish starts Next again from the first tab not opened; that is accepted.
- A campaign that is already published never shows Next, whatever the
  milestone says.
