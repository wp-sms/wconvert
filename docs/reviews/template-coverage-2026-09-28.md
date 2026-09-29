# Practical coverage: 48 campaign setups

Date: 2026-09-28. Status: editorially reviewed; release approval remains separate.

The studio contains **48 campaign setups using 36 distinct designs**, drawn from
the complete 70-design inventory. The latest 24 add ten store, nine service and
five publisher workflows. Total coverage: 22 stores, 17 services, nine publishers;
all seven Goals and five Display Types. The full bundled registry has 73 Playbooks.
Every new brief explains why its existing design is reused. No colour variant is
counted as a new design.

## What changed

- Added practical enquiries, useful resources, store announcements and editorial
  campaigns. Requests acknowledge receipt without promising a booking,
  subscription or provider delivery. Restock announcements require a human-run
  mailing process; they are not automatic stock monitoring.
- Added translated business labels and a business filter to Goal-first creation,
  combined with existing format, collection and search controls. Untagged entries
  remain under All businesses; metadata does not restrict design eligibility.
- Raised the shared catalog index bound from 20 to 50 packs. Twelve designs per
  pack and the 256 KiB transport limit remain. A 51-pack response preserves the
  working cached index. This is capacity preparation, not a completed 500-design
  distribution or paid-assets implementation.
- Added a guarded disposable WordPress/MySQL/WooCommerce review site, working
  resource pages, sample products/coupon/delivery, and a local mail outbox.
- Added paired full-height screen proofs. The overflow audit excludes explicitly
  clipped accessible labels, while continuing to check visible layout.

## Evidence

[The review record](template-coverage-2026-09-28.json) includes the browser's
exported decisions for all 24 new campaigns, exact campaign/renderer revision
hashes, 24 screenshot hashes, final layout output, preview interactions and native
WordPress checks. Decisions were saved after the final rebuild. Changes to copy,
structure, setup or renderer invalidate the studio's previous decision.

All new campaigns were inspected visually on desktop and 320px phone frames,
including every acknowledgement. Two crowded headlines were shortened; repeated
fine print was clarified on cleaning and callback examples. The changed four were
rebuilt, recaptured and inspected again. The final audit checked **720 cases at
320, 390, 768 and 1440px, in LTR and RTL, with zero measured layout findings**.
This is not a blanket accessibility or contrast certification.

All 24 new preview journeys were driven with their visitor controls. Applicable
forms exercised simulated failure/retry and reached their acknowledgements.
Landscaping advanced through its intermediate screen. Optional headline SMS was
also skipped successfully at 320px; Back retained and protected the accepted email.
These preview submissions create no real Lead.

The real site published all 48 campaigns through native REST controllers. Native
capture tests verified missing-required-field refusal, successful stored values,
canonical phone numbers, selected preferences, replay safety and a single Lead
across optional-channel captures. All six resource campaigns produced exactly one
local email for each new request, with a working content-page link. Result/product
links resolve to real sample content/products.

Separate browser checks exercised Goal-first filtering, creation, editing, saving
and publication; a real welcome submission and coupon reveal; and a real callback
submission using the phone library's GB-to-US country change and a service choice.
WooCommerce applied DEMO10 at 10%, charged £4 UK delivery below the threshold,
and offered free delivery over £40 after discounts. The cart reminder opened the
native basket with items present and was withheld when the basket was empty.

These checks caught demo-only problems: generic destinations where specific
resources were promised, overwritten cart links/conditions, and frequency defaults
that prevented repeat review. The harness now preserves audience conditions,
uses native cart URL resolution and explicitly enables repeated demo viewing.
Reusable source Playbooks retain their actual suggested rules and normal defaults.

## Automated verification

- Full JS suite: 179 files / 3,307 tests passing; the final discovery change was
  rechecked with all 31 Goal-screen tests.
- Full PHP suite: 2,245 tests / 12,709 assertions passing; final Playbook checks
  also passed (74 tests / 2,130 assertions).
- PHPStan, TypeScript, ESLint, source contract and all 70 template definitions pass.
- Template studio checks: six tests passing. Free/Pro admin builds pass.
- Final real WordPress verifier: all 48 campaigns pass.

No shipping visitor code or database schema changed in this batch.

## Limits and next gates

Mail is captured in a local outbox: no external email/SMS was sent, and inbox
arrival/provider subscription is unproven. Newsletter/SMS demos collect locally.
Resource/product imagery includes existing placeholders; merchants supply their
own applicable assets, offers, schedules and destinations. Native mobile browser
viewport overriding was unavailable in this session; responsive proofs and the
320px interactive studio were used instead. The full real-site route matrix on
physical mobile browsers and external providers remains a release check.

The proposed skincare/gift/service finders, automated generation, shared review
storage, asset transport and a full 500-entry installation trial remain future
work. No conversion-lift claim is made. Continue in reviewed batches, guided by
coverage gaps and merchant outcomes rather than numerical novelty.

Rebuild with `npm run templates:pilot`. Open `out/pilot.html?batch=coverage` for
the latest batch and `out/proof.html` for paired screens. Follow the
[demo instructions](../../tools/design-library/demo/README.md) to reproduce the
real-site checks. Screenshots and site data remain generated local artifacts.
