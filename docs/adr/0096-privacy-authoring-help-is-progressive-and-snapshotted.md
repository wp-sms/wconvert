# Privacy authoring help is progressive and snapshotted

WConvert offers privacy guidance while a merchant creates a Campaign, but that
extra authoring help is not the privacy infrastructure itself. A site-wide
preference under Data & privacy therefore controls whether WConvert adds short
privacy copy to new Campaign setups and reviews it before publishing.

The preference is on by default. Turning it off simplifies future Campaign
drafts and the editor; it does not disable personal-data export or erasure,
retention, Consent Records, WordPress's privacy-policy suggestion, or the
read-only Data Map from [ADR 0094](0094-privacy-guidance-reports-the-current-data-flow.md).

## The preference applies at the Playbook boundary

A Playbook is copied into an editable Optin snapshot. Privacy guidance is
applied during that prefill operation and nowhere later, so changing the site
preference affects only Campaigns created afterwards. Existing drafts and
published Campaigns keep the words and controls the merchant already reviewed.

When guidance is off, a new setup omits the Playbook's automatic consent copy
and policy-linked fine print. Repeated fine-print roles keep their positions so
unrelated success copy cannot move into the form. The merchant can still add,
show, hide, require, and edit the same text and consent controls manually.

This is one non-autoloaded WordPress option rather than an Optin column. The
choice describes a site-wide authoring experience; storing it on every Campaign
would make the preference look retroactive and introduce a schema lifecycle it
does not need.

## Visitor copy is short and layered

Playbooks say what happens in the form's context, such as a reply, one download
email, recurring emails, or text alerts, then link to the site's Privacy Policy
for the complete explanation. Consent wording describes the action being
requested; it does not ask a visitor to agree to the Privacy Policy.

This keeps the first layer concise without hiding the fuller policy. WConvert
does not choose a legal basis, determine whether consent is required, publish a
policy, or claim that a Campaign complies with privacy law.

## Readiness guidance is advisory

With guidance on, the editor's readiness review reports whether a data-capture
form visibly links to the site's policy and whether a visible required consent
checkbox is present. Missing guidance raises an alert and offers an exact edit
path, but never blocks publishing. If WordPress has no Privacy Policy page, the
review points to WordPress's existing policy setting.

With guidance off, that review section is absent. The Campaign editor is
simpler, while manual design controls and all operational privacy tools remain.

## Consequences

- Existing Campaigns never change when the preference changes.
- New Campaign defaults can be simpler without weakening export, erasure,
  retention, policy guidance, or stored consent evidence.
- Per-Campaign customization stays in the existing editor instead of gaining a
  second override setting.
- Readiness remains practical authoring advice, not legal approval or a publish
  gate.
