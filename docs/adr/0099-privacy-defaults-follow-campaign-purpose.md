# Privacy defaults follow Campaign purpose, not Template choice

A Template describes structure: it may contain fields, a policy-notice slot and
a hidden consent control. It does not know why a Campaign asks for data. The
Goal's existing outcome contract does, so Privacy Guidance derives the starting
point from that purpose:

- a click-only Campaign captures no visitor data and shows no form privacy UI;
- an enquiry or one-time lead-magnet delivery starts with a short policy notice
  and no consent checkbox;
- an ongoing email or SMS list starts with the policy notice and an explicit,
  required consent checkbox.

These are editable authoring defaults, not a legal-basis decision or a claim of
compliance. Readiness reports missing notice or expected marketing consent as
advisory guidance and never blocks publication.

## The outcome contract is the one source of purpose

The closed Goal set already distinguishes an ongoing audience channel from a
one-time handoff. Email and SMS list Goals declare an `audience_channel`; enquiry
and lead-magnet Goals do not. Both PHP prefill and the editor's readiness review
read that same contract instead of maintaining a second Goal list or attaching
purpose metadata to designs.

Every submit Template keeps its consent node hidden in the library. During
Playbook prefill, Privacy Guidance binds the Playbook words and then reveals a
non-empty consent node for an ongoing audience Goal. When a merchant explicitly
changes Template, the server prepares the new snapshot against the Campaign's
Goal and applies the same rule. This closes the gap where changing visual design
could silently hide consent again.

A third-party Playbook that omits consent wording does not reveal a blank
required checkbox. Readiness instead reports that expected consent is missing,
with an edit path to the available control. Bundled marketing Playbooks are
required by tests to provide consent wording.

## The site preference still controls automation

When Privacy Guidance is off, WConvert neither removes nor changes consent
visibility during a later Template choice. New bundled Templates naturally keep
their hidden consent default, automatic policy and consent copy are omitted at
Playbook prefill, and the Privacy readiness section remains absent. Manual
controls and all operational privacy infrastructure remain available.

No database column or per-Campaign privacy mode is added. Existing Campaigns
remain their own snapshots, and the Goal outcome already persists the business
purpose needed to prepare a newly chosen design.

## Consequences

- One visual Template can safely serve several Goals without becoming a
  purpose-specific design matrix.
- One-time requests avoid an unnecessary checkbox, while ongoing marketing
  starts with explicit consent visible.
- Switching Template preserves the Campaign's privacy starting point.
- Merchants can still edit or override the result, and turning guidance off
  restores a simpler manual workflow.
- Readiness describes the configured form; it does not certify GDPR or choose a
  lawful basis for the merchant.
