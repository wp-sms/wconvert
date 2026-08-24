# Consent capture is first-class in the template

An opt-in consent checkbox is a **`consent` leaf node** in the template
vocabulary ([ADR 0010](0010-templates-are-configuration-not-documents.md)) with a
**`consent_text` [[Slot Role]]** beside it, not a required field the merchant
hand-adds. It is **off by default, required once present, and enforced
server-side**, and the evidence it produces is the [[Consent Record]] snapshotted
into the [[Lead]]'s existing `fields` JSON.

Records a decision from
[#11](https://github.com/navidkashani/wconvert/issues/11) that had no ADR of its
own. Its three refusals became
[ADR 0016](0016-wconvert-never-confirms-an-optin.md),
[ADR 0017](0017-no-visitor-identifier.md) and
[ADR 0018](0018-erasure-deletes-rather-than-anonymises.md); the thing it
*builds* was carried only by cross-references until now.

## Why a node rather than a field the merchant adds

A consent checkbox implemented as "a required field the merchant remembers to
add" is one the merchant forgets. And its label would be copy no [[Playbook]]
could reach — under
[ADR 0013](0013-playbook-copy-carries-no-markup.md) a Playbook binds words to
Slot Roles, so wording with no Role has no way in. Making it a node with a Role
puts the checkbox in the gallery's hands and its sentence in the Playbook's.

## Off by default, required once present

Defaulting it on would put a checkbox on the roughly 90% of installs that do not
want one and cost conversions for no gain.

Once added it is **required, not optional**. An optional consent checkbox
captures Leads whose consent was explicitly *refused*, which is worse than never
asking — the row then asserts a consent that the visitor declined on the same
screen.

The capture endpoint is public, so client-side validation is decoration: the
REST handler rejects a submission whose Optin declares a `consent` node and whose
payload lacks it.

## A Playbook supplies the wording, never the link

Generic consent copy is copy like any other and a Playbook carries it. The
privacy-policy URL is not: the **renderer** resolves it from
`get_privacy_policy_url()` at render time.

Same reasoning that keeps [[Destination]] ids out of Playbooks — a Playbook can
express nothing site-local — and it makes the link correct on every site without
any entry knowing which site it is on. **No policy set means the link node
renders nothing**, never a dead `#`.

## The proof is a snapshot, and it needs no storage

What is stored is the consent text **as submitted**, in the `fields` JSON
`wconvert_leads` already has. **No new column.**

A snapshot rather than a pointer to the template that produced it, because the
merchant will edit that wording and consent evidence that silently rewrites
itself to match the current copy is evidence of nothing. A separate consent
timestamp was explicitly rejected: `created_at` is already that, to the same
second.

## Consequences

- **The renderer, not the template, owns the link.** The same shape
  [ADR 0025](0025-cart-recovery-captures-nothing.md) reuses for the cart URL, and
  for the same reason.
- **`consent_text` is a Slot Role like any other**, so switching Template does
  not destroy the merchant's wording.
- **This is the only consent WConvert captures from a visitor.**
  [[Storage Consent]] is a different thing entirely — ePrivacy permission to
  write to the device, asked of every visitor, read through the WP Consent API —
  and the two must not share a word. Nor is it a consent *lifecycle*: it records one act at
  one instant and is never revisited
  ([ADR 0016](0016-wconvert-never-confirms-an-optin.md)).
- **It is what makes a Lead unimportable.** There is no wording to snapshot for a
  person this system never showed anything to, which is the clause
  [ADR 0031](0031-a-lead-has-exactly-one-origin.md) turns into a rule.
- **The export carries it and erasure destroys it with the row**
  ([ADR 0018](0018-erasure-deletes-rather-than-anonymises.md)). Consent evidence
  that does not travel with the data it justifies is useless to the merchant at
  the moment they need it most.
