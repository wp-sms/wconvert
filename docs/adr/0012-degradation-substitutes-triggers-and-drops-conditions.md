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
- **A premium condition is dropped.** No substitute, ever.
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

The two never touch the same Optin: prefill covers those authored on an install
without Pro, enqueue covers those authored with it and now running without it.
Together they mean **losing Pro degrades rather than stops**, and capture keeps
working.

## Consequences

- **Prefill bakes the substitution into `config` and records a `degraded_from`
  marker beside the substituted rule.** No new storage — it rides an
  already-approved blob.
- **An upgrade never silently re-upgrades a running Optin.** The marker anchors a
  one-click offer in the editor instead. Changing a live popup's behaviour on a
  licence event with no human in the loop is the same class of surprise #3 made
  structurally impossible for the post-dismissal runner-up.
- **The marker is the on-screen surface of the degradation**, rendered as a
  persistent inline note on the rule row — never a dismissible banner, which is
  dismissed once and leaves the Optin carrying an invisible substitution forever.
- **#14 inherits the mechanism and owns only the entitlement primitive it calls
  and the upsell destination.** Its "do optins stop, degrade, or keep running?"
  question is answered here: they degrade. #14 resolved that primitive to
  "is Pro loaded" and nothing else — see [ADR 0015](0015-enforcement-is-by-non-registration.md).
- **`click_element` never appears to degrade**, because #3 already made its
  selector author-only and blank in any Playbook-prefilled Optin.
