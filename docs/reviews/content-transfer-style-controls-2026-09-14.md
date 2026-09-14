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

- Full PHP suite: 1,876 tests passed. Local QA then exposed a split traversal
  omission; the fix uses `TemplateTree::CHILD_KEYS`. All nine picture-transfer
  tests and PHPStan passed after that correction.
- Full JavaScript suite: 2,330 tests across 96 files passed. Coverage includes
  padding shorthand and link/unlink behavior, custom CSS preservation, gradient
  editing, mobile reset isolation, and stripping notices before Apply.
- TypeScript, ESLint, PHPStan, all 50 template registrations, the Free/Pro source
  contract, both admin builds and all four loader budgets passed.
- Real local WordPress REST retained the test background when switching from
  Fieldwork to Sunday marginalia, reported an unmatched picture for Inline rule,
  and saved/read back the prepared candidate as an unpublished draft without
  transient report metadata. The test used WordPress's existing blank image.
- One combined browser pass checked gradient direction edits, padding edits,
  mobile override summaries and reset. Undo restored each change and returned
  Save draft to its disabled state. Desktop and mobile canvas views were checked.
- The temporary draft was removed; all six original Optin hashes matched their
  baseline. No campaign was published and no Lead or delivery was created.

Review results follow once the two bounded passes finish.
