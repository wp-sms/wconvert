# 0129: Display rules: plain questions and quick picks

Date: 2026-10-07. Status: accepted.
Amends [0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)'s precedence for Quick picks on Free, [0104](0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md)'s
workspace and rule-set library, [0072](0072-setup-choices-state-their-effect-and-scope.md)'s
section names and replacement review, [0086](0086-campaign-setups-explain-handoff-and-format.md)'s
*Display rule sets*, [0054](0054-every-control-has-the-shape-of-its-value.md)'s
end-date door and [0116](0116-free-shows-nothing-it-cannot-run.md)'s list of
surfaces. Replaces the *Starting point* entry in `CONTEXT.md` with **Quick pick**.

Most Campaigns reach the Display rules tab already filled in by a [[Playbook]],
so the tab's job is to **check and adjust**. The workspace from ADR 0104 did the
job but was hard to read: the same summary appeared three times, numbered steps
made it look like a wizard, labels were the engine's (*Opening moment*, *All
rules (AND)*, *tab session*), and the common choices sat behind *Add a rule* →
search → preset, or in a separate *Display rule sets* dialog.

## Five plain questions

The tab asks **Where does it show? · Who sees it? · When does it open? · How
often? · Dates**, one at a time, from a side menu. Each menu item shows its
answer, or an amber *Needs attention*. There are no step numbers and no
summary panel. Dates is its own question rather than a corner of *How often*,
because when a Campaign runs at all is a coarser fact than how often one
visitor meets it.

The tab opens on the first question that needs attention, otherwise on Where.
Readiness, Campaign details and the Playbook facts read the same five answers
from the same `summarise()`, looked up by id rather than by position. Dates
stays non-blocking in Readiness, as the schedule was.

## One sentence above the grid

The answers read as one sentence — *"Shows on [every page except /checkout/*]
to [everyone], [after 15 seconds], [once per visit]."* — with a second, *"It
runs [from … to …]."*, when dates are set. Each bracketed answer is a button
that opens its question; the connecting words around it stay plain and muted.
The open answer is current, one that needs attention is amber. Every frame is a
translated string with a `%s` — `Shows %1$s %2$s, %3$s, %4$s.`, then `on %s`,
`to %s` — so a language that reorders them moves placeholders rather than
splicing words. Pages are named where that needs no lookup (a URL path, a
content type) and counted otherwise. *Test a visit* sits beside it.

## Quick picks first; the rule builder behind Custom…

Each question offers [[Quick pick]]s — *Entire site / Blog posts only / Selected
pages*, *Everyone / Phones only / Computers only / Signed-in / Signed-out /
Shoppers with items in their cart*, *Right away / After [15] seconds / Scrolled
[50]% down / When they pause for [30] s / When they try to leave / Leaving or
scrolling back up / When they click [selector]*, *Once per visit / Once every
[7] days / Only once ever / Every page they see*, *Until you pause it / Between
two dates* — and **Custom…**, which opens the full group and rule editors.

**A pick is matched by shape, never remembered.** Nothing stores which pick was
chosen. A pick asks the stored value whether it has the pick's shape — one group
holding one `device` rule whose set is `{mobile}`, an automatic opening holding
only `scroll_depth`, and so on — so a prefilled Campaign, an undo and a draft
from another tab all show the pick they actually hold. A chip with a number
reads its real number, edited inline: a 70% scroll rule is *Scrolled [70]%
down*, not a chip that claims 50.

**The sticky rule.** While a question is open, an open pick the merchant chose —
Custom…, Selected pages, Between two dates — stays chosen even if what they type
comes to match a quick pick, so the editor does not vanish under their cursor.
Re-opening the question, or an undo or redo, derives the pick again. A stored
rule this site cannot offer — hidden on Free, locked after a downgrade, waiting
on a plugin — derives as Custom…, so the rule stays on screen with its own row
explaining why it will not run.

A pacing pick changes only the pacing keys: the stop settings keep their values
whichever pick is chosen. A pick's availability is the least available of the
rule types it writes, with `unavailable` outranking `locked` (ADR 0026). On a
lower tier a locked pick is drawn with a grey lock badge and refused with a
reason; on Free it is not drawn (ADR 0116).

**On a free install a paid pick is hidden even when a plugin is also
missing.** ADR 0026 lets `unavailable` win, which would draw *Shoppers with
items in their cart* on Free as "Needs WooCommerce" — a pick that would then
disappear the moment WooCommerce was installed, because it is also locked.
So for picks, on Free only, a paid rule type reads as `locked`. ADR 0026
carries the note; rule rows keep its precedence.

## The client owns the picks; the server ships no library

The picks live in one client module, `rules/picks.ts`. `RuleBundles.php` and the
`bundles` key on `GET /wconvert/v1/rules` are deleted. A pick writes the same
`display_rules`, `targeting`, `frequency` and `schedule` the editors write —
every rule through `freshRule()`, every group through `emptyGroup()` — so
`DisplayPlan.php` validates it like any other edit, and no schema, storage or
loader behaviour changes.

**No pick reaches into another question.** The old *Remind shoppers before they
leave* set wrote a cart Condition and an exit Trigger at once; it is split.
*Shoppers with items in their cart* is a Who pick (Elite, needs WooCommerce),
and *When they try to leave* is a When pick.

## Placement and the rule picker speak the same language

Placement, under *Where does it show?* for an inline Campaign, uses the tab's
chips for its method (Manual, Automatic, Content lock) and its position, with
the paragraph number inline, and puts its instructions in the same settings
card as the stop settings. Switching to automatic placement or a content lock
asks first only when that would change another answer, and lists each change
as question, from and to. Amends [0099](0099-automatic-inline-placement-uses-rendered-content.md)
and [0102](0102-content-lock-is-an-optional-inline-capture-journey.md).

No native disclosure hides setup facts on this tab: the content lock's *Setup
details* and the click selector's *How to choose a button or link* are short,
visible lines now. The two disclosure cards the approved mockup drew —
minimum time and priority — stay, closed showing their value.

The rule picker is sectioned (Content, Address, Account, Their visit, Cart,
Time and scrolling, What they do), and every rule shows an icon and one line of
what it looks at. A rule with presets offers them as chips beside *Custom…*.
Rules the site cannot add keep their own muted sections, explained and never
offered.

## Test a visit describes a visitor, not an event

*Test a visit* asks for one visitor in the tab's words — the page they are on
(one choice per *Show it on* and *But never on* rule, and any other page), their
device, whatever the audience rules ask about, what happened before this visit
and, when dates are set, the visit date — and shows only the fields this
campaign's rules use. A rule with no natural field is a plain yes or no. The
answer is read with the loader's own functions (`audienceMatches`, `isAllowed`
plus the per-visit cap, the time-of-day window) and reported as the five
questions in screen order, each with a *Change* link to its section. The first
that fails gives the one reason; otherwise it *Opens* with the sentence's own
When phrase. Timing is described, never simulated, so When only describes —
except that leaving alone can never open it on a touch screen, which it says.
Amends [0104](0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md)'s
sample tester. Source: [visit](../../resources/admin/src/builder/rules/visit.ts).

## What was dropped

Following [ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md),
lines that changed nothing the merchant would do next are gone: *Page exclusions
and limits apply to all visitors*, *Opens when page, audience, schedule and
repeat rules allow*, *Clicks can reopen a closed campaign…*, *Limits are per
browser…*, *Every rule below must match together*. The site-wide limits note
appears only when a site-wide limit is set. The *Display rule sets* dialog, its
before/after review and its search are removed with the bundles.

Sources: [picks](../../resources/admin/src/builder/rules/picks.ts),
[QuickPicks](../../resources/admin/src/builder/rules/QuickPicks.tsx),
[DisplayRules](../../resources/admin/src/builder/rules/DisplayRules.tsx),
[summaries](../../resources/admin/src/builder/rules/summaries.ts),
[sentence](../../resources/admin/src/builder/rules/sentence.ts).
