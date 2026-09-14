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

## Standards review

Independent Luna Extra High review found a redundant Custom CSS toggle for
spacing expressions that cannot use side controls. It is now hidden in that
case, with regression coverage. The split traversal finding was already fixed
with the shared child-key vocabulary. The optional suggestion to consolidate
picture preparation and report calculation remains a small internal cleanup;
both paths currently call the same deterministic matching implementation.

## Specification review

Independent Luna Extra High review found that a mobile value equal to desktop
was incorrectly marked as different. The indicator now compares the effective
values, including inherited desktop values; three regression cases cover this.
The requested verification record is populated above.

The suggestion to treat every plain root as a photo destination was not adopted:
an empty root does not establish that text will remain readable over a photo.
The transfer instead reports the missing match before Apply. ADR 0084 now makes
this suitability rule explicit, and a regression test covers it. Explicit panel
and media picture slots remain eligible even when empty.

After these review changes, all 93 focused frontend tests and all 10 picture
transfer tests passed, along with TypeScript and ESLint. Both admin builds were
rebuilt for the local installation.

## Layers hover follow-up

The user reported excessive list tooltips. The Layers row carried separate native
hover messages on conversion, style-count and text-transfer badges. These now
use explicit labels without hover popups: “Counts conversions”, “Text stays in
this design”, and named desktop/mobile style counts. Screen-reader descriptions
remain available; mobile-only style settings are also counted. ADR 0065 is
amended inline.

All 102 structure and scope-style tests passed, including keyboard interactions
and the absence of row title attributes. TypeScript, ESLint and both admin
builds passed. Local WordPress responded successfully and served both updated
builder assets. No browser session or draft mutation was needed for this fix.
