# Second campaign batch, 2026-09-28

The user approved the first twelve and asked to continue. This batch adds twelve
reviewable setups, bringing the studio to 24 setups using 21 distinct designs.
The repository now contains 70 designs and 49 registered Playbooks. Ten Playbooks
are new; standalone SMS and the plain inline cart return reuse registered starts.
Four new Free designs serve five of the added setups; seven setups reuse designs
that existed before this batch. No existing merchant snapshots were rewritten.

## Coverage and design decisions

| Setup | Type | Design decision |
| --- | --- | --- |
| Plain cart return | Inline | Reuse Inline call to action |
| Delivery guidance before returning to cart | Inline | Reuse Cart nudge |
| Standalone release SMS | Popup | Reuse Stacked signup |
| Genuine sale deadline | Floating bar | Refine Deadline bar hierarchy |
| Knitwear care guide | Inline | New Resource index |
| Wholesale enquiry | Inline | Reuse Service docket |
| Venue visit request | Popup | New Appointment note |
| Course advice request | Popup | Reuse Appointment note intentionally |
| Monthly maintenance letter | Inline | Reuse Reading desk |
| Seasonal service information | Slide-in | Refine Corner nudge hierarchy |
| External workshop registration | Inline | New Agenda card |
| Reading preference with email signup | Inline | New Preference card |

The four new designs have no identical canonical structure/style match. Their
closest structural comparisons were reviewed alongside actual rendered output.
The event composition was revised into a typographic invitation beside a ruled
agenda because an earlier grid treatment resembled the resource index too closely.
The course and venue forms remain one design; their qualification questions and
follow-up needs make useful separate setups, not separate visual designs.

## Production workflow improvements

Collection schema 2 requires batch membership, meaningful-difference notes,
publication prerequisites, setup suggestions, an honest metric and an explicit
new/reused design comparison. Non-benchmark briefs must name valid existing design
IDs and explain the decision. Missing comparisons and invalid metadata fail the
build. This is deterministic editorial validation, not automatic semantic or
image-based originality certification.

The studio shows batch and goal filters, a goal-by-audience coverage matrix and
correct campaign-level paid requirements. Cart recovery remains Pro even when its
underlying design is Free. It labels the display type as Inline for click-only
campaigns as well as forms. Browser-local review storage and source approval
records remain distinct; first-batch user approval is recorded against its
previous campaign hashes, not silently transferred onto changed entries.

Offscreen audit images now load eagerly before decoding. The earlier lazy image
behaviour could leave the measurement runner waiting indefinitely. Countdown
slots receive explicitly labelled sample values in both review tools so their
occupied space is measured; no deadline is inserted into shipping configuration.
Preview navigation resets scroll to reveal the next screen and opening a new
campaign resets the simulation notice.

## Verification performed

- All twelve expansion campaigns inspected in the browser at desktop and small
  phone widths, including every acknowledgement. Forms below the initial visible
  area were inspected by scrolling. The final mobile resource spacing, event
  composition, preference acknowledgement and shorter seasonal CTA were inspected
  again after their last edit. Representative screenshots are in the generated
  `tools/design-library/out/` directory, including `expansion-preview.png`.
- Studio: 360 screen cases across all 24 campaigns, at 320/390/768/1440 in LTR/RTL,
  zero layout findings. Includes CTA size, input type size, badge alignment and bar
  hierarchy. This evaluates actual prepared campaign trees.
- Full library: 2,128 rendered cases across 70 designs, every screen at four widths
  in both directions with normal and longer copy, zero measured failures. Solid
  text contrast, control size, input size and overflow are included. Raw evidence
  is generated `out/expansion-audit.json`.
- Browser interaction: goal filtering shows the two cart campaigns; coverage
  matches 24 setups; preference signup accepts email without the optional choice;
  wholesale enquiry accepts the optional category; local acknowledgements appear
  without sending data. Final copy does not claim a preference was supplied when
  it was skipped. Countdown preview is explicitly a sample.
- PHP suite: 2,219 tests, 12,197 assertions. JavaScript suite: 178 files, 3,303 tests.
  Studio contract suite: six tests. Template integrity: all 70 survive registration.
  Source verification and changed build-script ESLint checks pass.
- Real WordPress Playground with Free and Pro loaded through normal boot: all 24
  campaigns prepared through the application container's Prefill service.

## Remaining boundaries

These checks do not establish conversion uplift, comprehensive accessibility
conformance, or correct merchant-specific destinations. The preview sends nothing.
Actual sale dates, coupons, cart behaviour on a configured WooCommerce shop,
resource email delivery, preference mapping, event registration and enquiry
follow-up still require their documented merchant setup and end-to-end trial.
There are no new database tables, automatic remote tracking or external artwork.
The remaining 24 pilot briefs, customer-facing discovery and catalog distribution
work are separate milestones. This branch remains a draft PR.
