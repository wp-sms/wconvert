# 0176: A new site is guided to its first lead

Accepted 2026-11-01. Amends [0144](0144-help-is-a-page.md) decision 1 (the
submenu), [0091](0091-shared-settings-and-submission-workflows-have-distinct-homes.md)
(Settings categories), [0171](0171-one-template-gallery.md) §7 (the Campaigns
⋯ menu) and the CONTEXT.md note on the UI word for a [[Template]].

Approved prototype: claude.ai/artifact/7kfMUDZUzGU3rbrxADFEcs (13 boards,
reviewed 2026-11-01).

## Context

Two testers found it hard to understand how to work with the plugin. Tracing
the first ten minutes showed nothing guiding a new user:
- Activation landed wherever WordPress left them.
- The empty Campaigns list showed an icon menu holding "New occasion".
- Milestones were recorded, but no screen showed them.
- The thing you pick was called a "ready-made setup", a "template", a "design"
  and "Started from".
- Nothing ever emailed the owner, so they had no reason to come back.

## Decisions

**1. A getting-started checklist on Campaigns.** It is one card with three steps,
and its goal is the first live campaign:

| Step | Done when | Its button, when it is the current step |
|---|---|---|
| Create a campaign | any campaign exists (or `first_publish`) | Create campaign → the goal screen |
| Publish it | `first_publish` | Review & publish → the newest draft's editor |
| Get your first lead | `first_conversion` | View your site → the home URL, new tab |

Only the current step has a button, and a step that can't act yet shows none
(no draft, no valid home URL). The card's foot links the walkthrough video
(`create-your-first-campaign/#watch-the-walkthrough`, 2 min 50 s, so the label
says "3-min") and the guide. Both open on wconvert.io.

- **Progress is read, not stored.** The card reads `GET /milestones` and the
  list the screen already loads.
- **A site whose campaigns only show a message counts views.** "Show a message"
  converts on nothing (ADR 0163), so step 3 would never finish. When every published
  campaign's Goal (every campaign, before the first publish) has `outcome.action === 'none'`, step 3 is "Get your first
  view" and reads `first_impression`.
- **On an empty site the card replaces the empty state.** While the milestones
  load, the sheet shows its skeleton, so the plain empty state never flashes. A
  failed milestone read hides the card and leaves the list as it was.

**2. One stored fact: hidden, per user.** User meta
`wconvert_checklist_hidden_{blog_id}`, written by `POST /getting-started/hide`
and read into `window.wconvertAdmin.checklistHidden`. Two things write it:
- the ×, at any time;
- "You're all set", when it is shown.

The milestones alone can't tell the visit that first sees all three steps done
from every visit after it. So the all-set state writes the flag while it is on
screen, stays for that visit, and is gone on the next one. There is no table
and no site option.

**3. One redirect after activation.** `activate()` sets a 60-second transient.
The next `plugins.php` load (where WordPress lands after activating) deletes it
and redirects to `admin.php?page=wconvert`. The transient is read only on
`plugins.php`.

It does not redirect in any of these cases:
- bulk activation (`activate-selected` with more than one plugin, or
  `activate-multi`)
- network activation
- WP-CLI or AJAX
- a user without `manage_options`
- a site that already has a campaign (a reactivation)

**4. A weekly summary email.**
- **What it reads.** `Dashboard::compare()` over the last 7 complete site days,
  so every number matches Analytics' "Last 7 days".
- **What it says.**
  - The headline result, which is submissions when any campaign collects them,
    else the largest result group.
  - Three tiles: Shown, the result and its rate. Each is compared with the week
    before.
  - "Best campaign" (with 2+ published campaigns) and Insights' first card.
  - Buttons: Open WConvert (`#analytics?days=7`) and View leads (only when the
    result is submissions).
  - A footer link to Settings to turn it off.
- **It holds aggregate counts and campaign names only.**
- **When it is skipped.** It is not sent before `first_publish`, and not for a
  week in which nothing was shown. The first summary after `first_publish` says
  "First week" in place of comparisons.
- **When it is sent.** `wconvert_weekly_summary` is a WP-Cron `weekly` event
  scheduled on `init` for the next Monday at 09:00 site time. It is cleared on
  deactivation and uninstall. WP-Cron's week is a fixed 7 days, so a clock
  change moves later sends by an hour; Settings says "in your site's time zone".
- **How it is sent.** `wp_mail()` as HTML with a plain-text part, behind
  `SummaryMailer`. The From name becomes "WConvert" only when it is still
  WordPress's default.
- **How it is built.** The markup is the prototype's: tables, inline styles and
  no images. One `<style>` block adds phone stacking and a dark palette.
- **Settings → Email reports** (a new category after Data & privacy):
  - an on/off switch, on by default;
  - the recipients, defaulting to `admin_email` (an empty list follows it), up
    to 5, comma separated;
  - a "Send a test email" button. It sends this week's summary now, subject
    prefixed "Test:", to the addresses typed, saved or not, even with zero data.
  - It is stored in one option, `wconvert_weekly_summary`. Settings → Data &
    privacy lists the summary under "Sent to other services" while it is on.

**5. One word: template.** The thing you pick from the gallery or start from is
a **template** in every string, including the free-text agent reader's "Custom
template". **Design** stays only where it means how the campaign looks right
now: "Fit whole design", "Design default", "Design & content".

Three strings were open at review and take the prototype's proposals:
- The pinned link reads "Use this template with your own words, or pick a
  version below with words written for your goal."
- The gallery's inspect dialog names the underlying layout "Layout: %s".
- Import and export read "Import template" and "Export as template".

**6. Small first-run polish.**
- The WConvert submenu is Campaigns, Analytics, Leads, Settings, Help, each a
  hash route into the one page. `App.tsx` marks the current section with
  `markSubmenuCurrent()`.
- The Campaigns ⋯ menu (New occasion, Import occasion) is hidden until the
  site's first campaign. The card is a new site's one door.

## Departures from the prototype

- **No Undo toast after ×.** It would need a second write route to unhide.
  Instead, focus moves to the page title, and the walkthrough and guide stay
  reachable from Help.
- **The video label says 3-min**, not 2-min, because the video is 2 min 50 s.
- **The readiness dialog's inline link says "Browse templates".** With the fix
  button also called "Choose a template", two same-named buttons would have
  sat in one dialog.

## Consequences

- An upgraded site that already reached all three milestones sees "You're all
  set" once.
- Import is no longer reachable on a site with no campaigns. That reverses #280
  for empty sites only.
- Considered and rejected:
  - A table for checklist progress: it is computable on read.
  - A site option for the hidden flag: hiding is one person's choice.
  - An email with remote images: it breaks with images blocked and leaks opens.
