# Degradation substitutes triggers and drops conditions

Amended by [ADR 0015](0015-enforcement-is-by-non-registration.md): the enqueue call
site below is grounded on **Pro's absence**, not on a lapsed licence. A licence never
gated features, so the licence-lapse framing this ADR originally used described an
event that does not occur. The call site itself is unchanged and better justified —
plugin absence is a fact, where a licence lapse was a business decision we were free
to reverse.

When a Playbook asks for a rule the install is not entitled to, the fallback is
declared **in #3's rule manifest**, beside the `tier` and device-applicability
fields already there, and applied by a thin resolver at **two call sites**:
Playbook prefill, and asset enqueue.

The substitution itself is asymmetric by rule kind:

- **A premium trigger is substituted.** `exit_intent` → `time_on_page`,
  `scroll_up` → `scroll_depth`.
  *Built in [#33](https://github.com/navidkashani/wconvert/issues/33). The
  substitution property is **`substitute` on the rule manifest entry**, beside
  `tier`, `consent_category` and `on_absence` — and it is a COMPLETE rule
  rather than a type name, because `time_on_page` reads `rule.seconds` and
  `Number(undefined)` is NaN: a substitution naming only the type swaps one
  silent, total loss of function for another.
  `tests/unit/Rules/RuleManifestParityTest.php` asserts that every declared
  substitute names a free type of the same kind and fills every param that
  type declares, and that **only a Trigger may declare one** — which is where
  "a condition is dropped, no substitute, ever" stops being a sentence and
  starts being a build failure.*

  ***And the table is no longer the whole guarantee.** #33 found the gap
  between this bullet and the manifest: `click_element` is a premium Trigger
  with **no honest substitute**, since its selector names something only one
  site has. Dropping it is right; dropping the LAST Trigger is the silent,
  total loss this ADR names two paragraphs down. So
  [`Degradation`](../../src/Rules/Degradation.php) checks the post-condition
  rather than trusting the table: an Optin whose rules named a Trigger going in
  and name none that could fire coming out is **[[Suspended]]** — the same
  outcome as the silent loss, with a cause on the list screen and no repair
  step when Pro returns. That is this ADR narrowed in exactly the shape
  [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md)
  already narrowed it, and it means "an Optin never ends up with zero Triggers"
  holds structurally rather than because somebody remembered to write a
  substitute.*
- **A premium condition is dropped.** No substitute, ever.
  *Enforced as of [#33](https://github.com/navidkashani/wconvert/issues/33)
  rather than remembered: a Condition declaring a `substitute` fails the
  manifest parity test.*
  *Narrowed by [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md):
  except where the Optin's copy asserts the fact the condition guarantees, which
  makes dropping it say something false rather than widen an audience. Such a
  condition carries `on_absence: suspend` on the rule manifest, and an Optin
  holding one is **suspended** rather than shown without it. `drop` stays the
  default, so this ADR is the rule and 0027 the marked exception. The
  free-install half of the same boundary is closed by
  [ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md), which makes the
  cart Goal `tier: pro` so an Optin needing a cart condition cannot be built
  without one.*
- **Display type does not degrade at all** — a Playbook whose type is premium is
  shown as an upsell card and is not selectable.

## Why the manifest owns the table

The alternatives were the Playbook declaring its own fallback, or a standalone
resolver table.

A Playbook-owned fallback means every third-party entry re-invents it, and any of
them can specify a nonsense substitute — a remotely-sourced entry declaring what
should run in place of a feature it cannot have is capability-adjacent, which is
the line #7 drew. A standalone table is a third hand-maintained list to drift
against the manifest, and #3 rejected exactly that shape once already ("two
hand-maintained lists drift, and the drift is silent").

#3 also anticipated this: it recorded that device applicability is "a declared
property of the rule type in the manifest" and that "that declaration is also what
#13's substitution table keys off."

*Built that way in [#33](https://github.com/navidkashani/wconvert/issues/33),
and the count held: the resolver added **no list at all**. What decides whether
a rule can run is
[`SuppliedRules`](../../src/Rules/SuppliedRules.php) — a registry free fills
from the manifest's `tier: free` entries and [[Pro]] fills from its own, each
side asking the one manifest for its own tier and neither naming a rule type.
That is [ADR 0015](0015-enforcement-is-by-non-registration.md)'s "each registry
declares `tier` locally on members it already enumerates" applied to the rule
vocabulary, and it is what lets the enqueue call site below ask its question
without asking a tier question.*

## Why triggers must be substituted and conditions must not

#3 requires every Optin to carry at least one trigger, and made `page_load`
explicit precisely so that "shows immediately" is never an empty list. So a
*dropped* premium trigger leaves an Optin that can never fire — a silent, total
loss of function with nothing in any log, which is the failure mode #3 named as
the category's defining support ticket.

A condition is the mirror image. There is no honest substitute for "the referrer
is Google"; inventing one fabricates targeting the user never asked for and
silently narrows or redirects their audience. Dropping a condition only *widens*
the audience, which is the safe direction to fail in — the Optin still shows, to
more people than the Playbook intended, and the inline note says so.

## Why two call sites, and why they do not overlap

They exist for different failures.

**Prefill** exists for authoring honesty. #7 found that Guideline 9 fires on
showing a real control `disabled`, so a free user must be given a working rule
they can configure, not a locked one they cannot.

**Enqueue** exists for runtime correctness of Optins authored *while Pro was
installed* and running after it is gone — deactivated, deleted, or the site
restored from a backup that predates it. #2 and #9 keep entitlement out of the
stored projection and apply it at enqueue, so the premium rule is still sitting in
`config` when Pro stops being loaded. Stripping it there without substituting
reintroduces the zero-trigger bug above, on a live Optin, with no human present.

*Built in [#33](https://github.com/navidkashani/wconvert/issues/33) at
[`Payload::forRequest()`](../../src/Frontend/Payload.php), inside the loop that
narrows the published set to this request — because suspension decides
MEMBERSHIP, and a second pass over the result would build an entry only to
throw it away. **It asks no tier question**, which matters because
`tests/unit/Contract/NoLicenceOnTheFrontEndTest.php` reads that file's source
to make sure it never starts to: the question is "does this install supply this
rule type", answered by which code registered
([`SuppliedRules`](../../src/Rules/SuppliedRules.php)), not by a licence, a
tier, or "is Pro loaded".*

The two never touch the same Optin: prefill covers those authored on an install
without Pro, enqueue covers those authored with it and now running without it.
Together they mean **losing Pro degrades rather than stops**, and capture keeps
working.

## Consequences

- **Prefill bakes the substitution into `config` and records a `degraded_from`
  marker beside the substituted rule.** No new storage — it rides an
  already-approved blob.
  *Half-built by [#27](https://github.com/navidkashani/wconvert/issues/27) and
  finished in [#33](https://github.com/navidkashani/wconvert/issues/33):
  [`Prefill`](../../src/Playbook/Prefill.php) now resolves a Playbook's rules
  through the shared resolver, and the marker rides `config` beside the
  substituted rule as `degraded_from`.*

  ***It is provenance, not a param**, and the distinction had to be built as
  well as stated.
  [`RuleVocabulary::normalize()`](../../src/Rules/RuleVocabulary.php) keeps only
  the params a type declares, so the marker had to be exempted explicitly to
  survive a save — and declaring it as a param instead would have drawn a
  control in the builder, inviting the merchant to edit the record of a
  substitution. It is also stripped at `partition()`, so it never reaches the
  browser: nothing that renders an Optin reads it, and the payload is inlined
  into every matching page against a 2KB budget.*

  ***Enqueue writes no marker, and needs none.** It persists nothing — the
  published set outlives the code that reads it — so there is nowhere to put
  one; and the case it covers is a rule still sitting in `config` at its own
  tier, which the builder's `locked` note already explains. That is what makes
  the two call sites disjoint in the CODE rather than only in the prose: prefill
  bakes the substitution in, so enqueue is a no-op on anything prefill touched.*

  *Free's bundled library still names only free's own rules
  (`tests/unit/Playbook/BundledPlaybooksTest.php` holds that line), so prefill's
  substitution is unreached by any entry that ships today. It is reached by a
  remote or third-party Playbook, which is the case ADR 0013 exists for, and it
  is asserted in `tests/unit/Rules/DegradationTest.php`.*
- **An upgrade never silently re-upgrades a running Optin.** The marker anchors a
  one-click offer in the editor instead. Changing a live popup's behaviour on a
  licence event with no human in the loop is the same class of surprise #3 made
  structurally impossible for the post-dismissal runner-up.
- **The marker is the on-screen surface of the degradation**, rendered as a
  persistent inline note on the rule row — never a dismissible banner, which is
  dismissed once and leaves the Optin carrying an invisible substitution forever.
  *The row exists as of [#29](https://github.com/navidkashani/wconvert/issues/29)
  (`resources/admin/src/builder/RulesEditor.tsx`), with the note rendered for the
  case that needs no marker — a rule authored with Pro and running without it —
  and nothing anywhere in that file or its stylesheet that dismisses one. The
  `degraded_from` note renders in the same place as of
  [#33](https://github.com/navidkashani/wconvert/issues/33).*
  ***And it survives an edit**, which is the half a marker can lose quietly:
  retiming a substituted `time_on_page` from 15 seconds to 30 must not
  un-substitute it, or the first edit retires the note and the upgrade offer it
  anchors — the invisible substitution again, arriving through the one screen
  that was supposed to show it. Removing the ROW is how a merchant is done with
  it, and that takes the marker with it.*
- **#14 inherits the mechanism and owns only the entitlement primitive it calls
  and the upsell destination.** Its "do optins stop, degrade, or keep running?"
  question is answered here: they degrade. #14 resolved that primitive to
  "is Pro loaded" and nothing else — see [ADR 0015](0015-enforcement-is-by-non-registration.md).
- **`click_element` never appears to degrade**, because #3 already made its
  selector author-only and blank in any Playbook-prefilled Optin.
  *True at PREFILL, and [#33](https://github.com/navidkashani/wconvert/issues/33)
  found the other end of it: an Optin AUTHORED with Pro can carry a
  `click_element` with a real selector, and on an install that lost Pro there is
  nothing honest to put in its place. It is dropped like any Trigger with no
  substitute, and where it was the last one the Optin is suspended — see the
  post-condition recorded on the first bullet above.*
  *Mechanised in [#29](https://github.com/navidkashani/wconvert/issues/29), and
  deliberately not as a special case: the selector is a param the rule manifest
  marks `authored`, which is the same declaration a post id and a term id carry,
  and `PlaybookLibrary` refuses any entry supplying one. So a registered
  Playbook cannot carry a selector at all, and "blank in any Playbook-prefilled
  Optin" holds because there is nothing downstream left to blank. A Playbook may
  still name the Trigger and leave the selector to the merchant, which is what
  an author-only param IS.*
