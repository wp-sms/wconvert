# Consent capture is first-class in the template

An opt-in consent checkbox is a **`consent` leaf node** in the template
vocabulary ([ADR 0010](0010-templates-are-configuration-not-documents.md)) with a
**`consent_text` [[Slot Role]]** beside it, not a required field the merchant
hand-adds. It is **off by default, required once present, and enforced
server-side**, and the evidence it produces is the [[Consent Record]] snapshotted
into the [[Lead]]'s existing `fields` JSON.

*Amended for planned progressive capture by
[ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): one combined
Lead can hold separate email and SMS consent evidence from different explicit
submissions. SMS consent cannot be inferred from email consent or possession
of a phone number. The single-checkbox contract described below is still the
current runtime; the new Template contract and storage representation are
specified in the companion [plan](../plans/184-progressive-capture.md).*

*Clarified by [ADR 0076](0076-an-enquiry-captures-one-optional-choice-before-handoff.md):
an optional service choice is a `field`, not this checkbox. Selecting a service
does not assert consent or a marketing subscription. The enquiry Playbook uses
request-specific privacy wording; its consent node stays hidden by default and
becomes required only when a merchant enables it, with the existing evidence
contract. [ADR 0099](0099-privacy-defaults-follow-campaign-purpose.md) makes the
same distinction across all Goals: ongoing marketing starts visible, while a
one-time request starts with notice only.*

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

Defaulting it on for every form would put a checkbox on requests that do not
need one and cost conversions for no gain. Templates therefore remain hidden by
default; Campaign setup reveals the control only for an ongoing marketing Goal
when Privacy Guidance is enabled (ADR 0099).

Once added it is **required, not optional**. An optional consent checkbox
captures Leads whose consent was explicitly *refused*, which is worse than never
asking — the row then asserts a consent that the visitor declined on the same
screen.

The capture endpoint is public, so client-side validation cannot authorise a
capture: the REST handler rejects a submission whose Optin declares a `consent`
node and whose payload lacks it. **Completed by
[ADR 0073](0073-capture-acknowledgement-is-not-provider-confirmation.md):** native
validation is useful visitor feedback, with an inline message and focus on the
first invalid field or checkbox. Server refusals use the same correction path,
preserving entered values. Neither replaces the endpoint's enforcement.

*Completed by [#24](https://github.com/navidkashani/wconvert/issues/24) on the
two questions building it raised.*

*First: **the check keys off the node's PRESENCE, never its wording.** A snapshot
carries [[Slot Role]]s and no words, so an Optin can hold a `consent` node whose
`consent_text` nobody has filled in yet — and keying enforcement off the text
would make exactly that Optin render a required checkbox the browser enforces and
the server does not, which is worse than either alone. Declaring the node is the
declaration; the wording is the evidence, and missing evidence is a copy gap for
the merchant to close rather than a licence to stop asking.*

*Second: **consent must be the JSON boolean `true` and nothing else.** Not a
truthy string, and not a schema-coerced one — WordPress's own
`rest_sanitize_value_from_schema` turns `"true"`, `"on"` and `"1"` into `true`,
which is why the route declares no type for the parameter and reads the posted
body raw. A lenient read is an optional consent checkbox by another name, and the
moment a string is read for truth, `"false"` asserts consent.*

## A Playbook supplies the wording, never the link

Generic consent copy is copy like any other and a Playbook carries it. The
privacy-policy URL is not: the **renderer** resolves it from
`get_privacy_policy_url()` at render time.

Same reasoning that keeps [[Destination]] ids out of Playbooks — a Playbook can
express nothing site-local — and it makes the link correct on every site without
any entry knowing which site it is on. **No policy set means the link node
renders nothing**, never a dead `#`.

*The enquiry examples in ADR 0076 therefore keep the surrounding sentence
complete without the link: `We use these details to respond to your request.
%s`. Removing an unresolved link must not leave a fragment such as `See our.`.*

*Completed by [#24](https://github.com/navidkashani/wconvert/issues/24) on how
the renderer knows WHICH link to resolve: **a link that declares a label and
names no destination is the site-resolved one.** One rule, and no table of node
types or [[Slot Role]]s to keep in step — a link the merchant gave an href is a
link they chose, scheme-validated at write under
[ADR 0013](0013-playbook-copy-carries-no-markup.md); a link with a label and
nowhere to go is asking for the one destination only the site can name. It is
resolved **per request** rather than baked into the published set, so moving the
policy page corrects every running Optin without republishing one, and that is
safe under the full-page cache because `get_privacy_policy_url()` is site-wide
and identical for every visitor.*

## The proof is a snapshot, and it needs no storage

What is stored is the consent text **as submitted**, in the `fields` JSON
`wconvert_leads` already has. **No new column.**

A snapshot rather than a pointer to the template that produced it, because the
merchant will edit that wording and consent evidence that silently rewrites
itself to match the current copy is evidence of nothing. A separate consent
timestamp was explicitly rejected: `created_at` is already that, to the same
second.

*Amended by [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md):
the first capture time cannot also describe consent accepted on a later SMS
screen. Record each acceptance time with its own unchanged wording and channel.
This changes the evidence contract; a storage design has not yet been approved.*

## Consequences

- **The renderer, not the template, owns the link.** The same shape
  [ADR 0025](0025-cart-recovery-captures-nothing.md) reuses for the cart URL, and
  for the same reason.
- **`consent_text` is a Slot Role like any other**, so switching Template does
  not destroy the merchant's wording. *Made true rather than merely intended by
  [#29](https://github.com/navidkashani/wconvert/issues/29): repicking a Template
  now carries the words across by Slot Role instead of taking a fresh copy of
  the design and dropping them ([ADR 0010](0010-templates-are-configuration-not-documents.md)).*

- **"Off by default" now means PRESENT AND HIDDEN, not absent.** *Corrected by
  [#29](https://github.com/navidkashani/wconvert/issues/29). Until slot
  visibility existed the two halves of this decision were in tension: a node
  first-class in the vocabulary "rather than a required field the merchant
  hand-adds", against a default that costs conversions on the roughly 90% of
  installs that do not want one. Shipping no node at all was the only reading of
  the second half available, and it quietly gave up the first — a merchant with
  no way to add a node had no way to reach consent capture either. Every
  submit-metered shipped Template now carries a `consent` node with
  `hidden: true`, so the settings panel — which edits content and visibility and
  never arrangement — switches it on in one click. The renderer skips a hidden
  node and `CaptureForm` treats one as absent, so nothing is enforced that no
  visitor was shown. A click-metered design ships none, because it captures
  nothing and there is nothing to consent to.*
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
