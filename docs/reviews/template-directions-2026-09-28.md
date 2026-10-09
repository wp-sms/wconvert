# Four design directions and honest use-case grouping

The previous expansion added useful campaign setups but very little visual variety.
The studio and customer creation flow now show shared designs once, with a use-case
choice. Filtering happens first: a matching use case cannot disappear behind a
nonmatching default. Selection changes the prepared preview, details and draft
creation together. Browsing still saves nothing.

The collection now has **100 setups, 51 referenced designs**, and 83 designs in the
full inventory. There are 125 registered Playbooks. Source-design counts are not
claims that every existing silhouette is independently unique or effective.

## The first four

| Design | Type | Visitor need | Composition |
| --- | --- | --- | --- |
| Product shelf | Popup / Free | Care for handmade homeware | Panoramic original product artwork over editorial and signup columns |
| Request folio | Popup / Free | Start a repair enquiry without a long form | A framed working area within a paper folio, with optional item choice before reply email |
| Studio invitation | Slide-in / Basic | Understand a writing session before attending | A shallow notebook illustration above concise sans-serif copy and a compact link |
| Useful detail bar | Floating bar / Basic | Check furniture dimensions and access before ordering | Two-level useful text beside a compact action, without an arbitrary badge |

The two SVG illustrations are original, embedded and reusable; no competitor
artwork is copied. Percent-encoded SVG keeps the existing payload budgets intact.
The next eight visual-variety briefs remain planned. They are not counted or
implemented before review of these first four.

The supplied invitation example is also refined: shorter wording, editorial
heading proportions, useful eyebrow, calm spacing and content-width primary and
secondary actions. Every existing leaf/field/submission ID is retained. Both
registered dependent Playbooks carry complete new copy. Saved merchant campaigns
are not rewritten; only the guarded disposable demo refreshes its snapshots.

## Inspection and practical verification

- Rebuilt the actual renderer and PHP-prefilled campaign proofs after the final
  template edits. Inspected all **10 new/refined screens**, paired at 768px and
  320px, in LTR and RTL (20 captures). Acknowledgements and the second enquiry
  screen receive the same review as first screens.
- Checked real published desktop output, then a **390 × 844** phone viewport for
  all four designs and the invitation. The phone invitation was advanced and
  submitted through the published controls. Final screenshots are in the adjacent
  `template-directions-2026-09-28/` directory. The comparison sheet crops the
  campaign area; full native screenshots retain page context.
- Whole-library checks: **1,672** screen/result/width/direction cases at
  320/390/768/1440, zero overflow, undersized-control, input-size, alignment or
  compact-bar hierarchy findings. Those checks do not substitute for inspection.
- Preview interactions: required email validation, explicit consent, simulated
  failure/retry, Back preserving both email and optional choice, and all capture
  acknowledgements. Request language acknowledges capture without promising a
  booking, subscription confirmation or delivered email.
- Native browser submissions saved product email/consent, an enquiry with no
  optional choice, and a second enquiry with `interest=chair`. The first keyboard
  select attempt left the optional field empty; a second run visibly selected
  “A chair” before proceeding, and the stored value was checked. Continue left
  the stored enquiry count unchanged at 2; only Submit created the next lead.
- Both informational links opened useful local pages: writing-session format and
  attendance guidance, and furniture/doorway/access measurements. Neither action
  claims a booking or purchase.
- The guarded WordPress/MySQL verifier passes for all **100 campaigns**, including
  required-field rejection, published capture, replay safety, saved values,
  configured links and the existing ten resource handoffs into a local outbox.
  External email/SMS delivery remains skipped.
- On real WordPress, switched the grouped bar from local class announcements to
  repair workshop announcements. Its audience, setup details and resulting draft
  matched the chosen repair use case; the editor showed “Hear about hands-on repair
  sessions.” The draft was not published.
- Local validation: **2,296 PHP tests / 13,587 assertions**, **3,363 JavaScript
  tests / 180 files**, 15 studio tests; TypeScript, ESLint, PHPStan, template
  registration and source contract pass. Admin Free/Pro builds pass. CI skipped
  at the user's request.

## Review scope and maintenance

Adding source designs changes the derived nearest-design list. Ten existing
campaign revisions changed for that reason alone. Their Playbook and design files
were compared byte-for-byte with the previously reviewed commit; renderer and
brief content are unchanged. The JSON records those paths and prior review IDs.
Their existing visual/journey evidence is retained explicitly, alongside fresh
whole-library layout/native verification. This is not represented as a new manual
inspection of every unchanged screen.

The five new/refined campaign approvals use this review's final evidence. Design
history records both the initial authoring and the adjustments found during review.
No design is retired, no customer update notification is added, and nothing is
merged or released. The two paid designs still need hosted marketing previews;
Free installs show informational cards without invented preview URLs.

The local in-app-browser evidence does not certify other browser engines or
physical devices, and none of these checks establishes conversion lift.
