# Content transfer and style controls — 14 September 2026

## Requested outcome

The user approved audit follow-ups 2 and 3: preserve more merchant content when
changing designs, and make gradients, spacing and mobile overrides easier to
edit. Cross-container Move to is explicitly deferred. Continue using
placeholders and mainly code-based verification. Do not publish campaigns.

## Acceptance

- Merchant background photos can carry to suitable slots when switching designs.
- Multiple photos are not silently guessed into an ambiguous arrangement; the
  candidate preview explains missing matches before Apply.
- Existing copy and destination transfer, Keep/Sample preview, draft separation
  and Undo continue to work. Transient notices are never saved into the template.
- Padding offers linked or independent sides; existing expressions remain editable.
- Gradients offer visual colors, alpha, direction and stop positions; unsupported
  CSS remains intact and editable.
- The selected element clearly lists mobile overrides and can reset its own
  overrides without changing its desktop settings or children.
- No generated artwork, schema changes, new renderer payload semantics,
  publication or external delivery.

## Implementation

ADR 0084 records matching rules, supported controls and the deliberate limits.
All controls use the existing token bags and draft history. Template transfer
uses the existing normalized snapshot preparation route.

## Verification

Verification and review results are recorded here before the PR is completed.
