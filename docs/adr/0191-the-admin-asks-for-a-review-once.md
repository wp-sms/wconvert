# 0191: The admin asks for a review once

Accepted 2026-11-20. From issue #420. Amends
[GUIDELINES](../../tools/design-system/GUIDELINES.md) §5 (colour roles), §6
(gradients and corners), §8 (the one marketing line, which
[ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md) set) and §18,
each inline.

Approved mockup: claude.ai/artifact/MY4VZ6U5niMSoPjk5vTopT (Note style, copy
A, reviewed 2026-11-20).

## Context

WConvert never linked to its wordpress.org reviews: not in the plugin row,
the footer or Help. Issue #420 asked for a way to hear from happy users.

Two wordpress.org guidelines set the limits. Guideline 11 allows a prompt
that is sparing, stays on the plugin's own screens and can be dismissed.
Guideline 9 bans pressuring people into reviews or rewarding them for one.

## Decisions

**1. The trigger is the site's first conversion.** It is the existing
`first_conversion` milestone, so a click-through counts as well as a lead.
Before it, nothing shows.

**2. The card asks twice at most.**

| State | What shows |
|---|---|
| No first conversion yet | nothing |
| First conversion, never answered | first look: Rate WConvert ↗ · Maybe later · No thanks |
| Maybe later, under 30 days ago | nothing |
| Maybe later, 30 days or more ago | last look: Rate WConvert ↗ · No thanks |
| Rate or No thanks | nothing, for good |

A second "Maybe later", which only a stale page could send, counts as No
thanks.

**3. Each admin decides for themselves, per site.** Their choice is user meta
`wconvert_review_ask_{blog_id}`, holding `''`, `later:<unix>` or `done`, as the
checklist's flag does ([ADR 0176](0176-a-new-site-is-guided-to-its-first-lead.md)).
Only people who can manage WConvert (`Routes::canManage`) see it.
`POST /wconvert/v1/review-ask` records `rated`, `later` or `declined`. The
boot flag `reviewAsk` says which look to show, or null.

**4. The first-conversion read is cached.** `Milestones::firstConversion()`
reads it, injected lazily into `AdminMenu` by its provider: where nothing
supplied it, such as a unit test, the card stays off. The milestone is `MIN(stat_date)`
over the whole stats table ([ADR 0140](0140-measured-reads-keep-their-indexes.md)),
and the boot flag would otherwise run it on every WConvert screen load for
anyone who hasn't answered. The transient `wconvert_first_conversion` keeps
a found day with no expiry, since it can't change, and "none yet" for an hour.
So the card can appear up to an hour after the first conversion. A user who
has answered never triggers the read at all. A transient adds no table or
column.

**5. One card at a time.** On Campaigns the card waits until the
getting-started checklist is put away, including its "You're all set" step.
On Analytics it sits at the top of the overview only, not on a single report.

**6. It is a thank-you note, and it asks everyone the same way.** It shows a
rose heart on lined paper, "Thank you for using WConvert.", one line on why a
review helps, and "— the WConvert team". It offers nothing in return and does
not ask for a star rating, so nobody is steered to a score (Guideline 9). It
does not ask first whether they are happy and send only the happy ones to
wordpress.org: that is review gating.

The rose `--love` and the paper tokens are new and used only here. `--love`
reads 5.5:1 on white, so the sign-off clears AA. The paper's rules and its
folded corner are gradients, and its corners are 12px. GUIDELINES §5 and §6
otherwise forbid all three, and are amended inline: the user chose this look
in the mockup, as a note rather than a work surface.

The last look's "If you have a minute, a review would mean a lot. We won't
ask again." is 15 words. It keeps ADR 0188's first exception: "We won't ask
again" says what is permanent.

**The card is not a marketing line.** GUIDELINES §8 allows one, the Pro hint,
and never on a dashboard. This card sells nothing and is the one other ask.

**7. The link is `https://wordpress.org/support/plugin/wconvert/reviews/#new-post`
with no UTMs.** [ADR 0189](0189-links-to-our-sites-carry-one-scheme.md)'s
scheme covers our own sites only.

**8. `wconvert_ask_for_review` turns it off.** It is for agencies and
white-label builds, the same pattern as `wconvert_show_pro_hints`
([ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 8).

**9. It is a React card, not an admin notice.** WConvert's screens suppress
`admin_notices`, and the plugin's own notices don't go through it
([ADR 0035](0035-the-admin-owns-its-page.md)). A card in the page also keeps
the ask on our screens only, as Guideline 11 wants.

**10. "Maybe later" on the card has its own translation context.** A
playbook's visitor-facing "Maybe later" is deliberately untranslated in the
Persian catalogue, and sharing its msgid would translate both.

## Consequences

- An answer hides the card for the rest of the page load too, so moving from
  Campaigns to Analytics doesn't show it again.
- If recording the answer fails, the card comes back next visit. That is the
  safe way round.
- Rate and No thanks are final. A "Maybe later" sent after one, from a second
  tab, changes nothing.
- Rate is recorded on a click or a middle-click. "Open in new tab" from the
  context menu fires neither, so the card stays until it is answered.
- Uninstall deletes the user meta. The transient goes with every other
  `wconvert_` transient.
