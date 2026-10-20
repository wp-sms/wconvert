# Twelve newer studio designs prepared for hosted delivery

Reviewed 2026-10-20 by Codex. This is a cross-batch delivery selection, not twelve newly invented source designs. The twelve previously unhosted setups use twelve different designs and twenty screens. Existing six delivery packs are preserved; two new packs add nine Free setups and three Pro setups.

## Visual judgement

Every authored screen was inspected at 320 and 1440 studio widths, with intermediate 390 and 768 views inspected as well. Every native input and acknowledgement was captured and inspected at 320 and 1280. The native frontend was rebuilt from this checkout before the final captures, replacing stale generated assets initially found in the disposable site. Final evidence shows the centred SVG dismiss icon and current select/phone chevrons.

- Maker notes: restrained plum panel, compact consent, clear monthly promise and matching acknowledgement.
- Callback slip: distinct header, contained phone form and next-step explanation. It requests a conversation, not a repair booking.
- Event calendar: warm calendar tile, venue/time information and one destination. Phone stacking preserves reading order. The date is illustrative and requires merchant editing.
- Product detail sheet: original lamp artwork and three useful facts; phone layout stacks at the smallest width. Hiding the optional artwork preserves the information hierarchy.
- Service process strip: compact numbered process alongside a grouped form on desktop, vertical process and contained form on phone. No detached consent or uneven three-card layout.
- Launch index: compact announcement bar, clear collection label, short description and link. Stacks cleanly on phone; close remains separate.
- Appointment agenda: serif consultation brief beside the enquiry, with optional topic and an honest no-booking acknowledgement.
- Accessible visit note: separate arrival and access sections with one link. Does not claim the venue itself is accessible.
- SMS message preview: lavender example-message panel, phone/country control, explicit required consent and matching acknowledgement. The example is clearly labelled as illustrative.
- Service fit brief: separates included review work from separately agreed implementation. Form and result do not imply a confirmed job.
- Earlier appointment enquiry: navy introduction, optional preference and email; acknowledgement explicitly preserves the existing booking.
- Equipment return checklist: warm editorial card, optional name, clear one-off request and no false collection/return confirmation.

The final `layout.json` records 320 cases (20 screens × four widths × two directions × normal/long copy) with zero automated layout, solid-colour text/field contrast or control-size findings. These measurements supplement visual judgement. Long-copy/RTL screenshots were separately inspected. The stress harness appends prose to every body-role value, including the event's numeric date; that deliberately unrealistic date tile grows vertically without clipping. Normal authored dates remain compact. This is layout testing, not an Arabic translation review.

## Practical use

`native-results.json`: 24 desktop/phone runs through real Prefill, publication and local WordPress capture. All eight forms reject missing required data; all email forms reject malformed email. Applicable optional selects were left empty on desktop and selected on phone. All eight reached their actual acknowledgement. The four information/link designs reached their local fallback destination (`native-links.json`); merchants must replace it with the real page before publishing.

`simulated-journeys.json`: all eight forms retained entered details after simulated failure, then reached acknowledgement on retry. No simulated result is represented as an external provider delivery test.

Additional short-phone checks at 320 × 568: consultation content scrolls internally (483px viewport / 819px content), focus reaches the form, and Close restores the page. SMS rejects a too-short phone number, supports searching/selecting United Kingdom in the full-screen country picker, and blocks valid-phone submission with unchecked required consent. Screenshots record the field, error and country picker. Native select chevrons, focus rings and dismiss buttons were visually inspected. Optional product artwork removal was inspected separately.

## Packaging correction and assets

The message-sample base design now starts with consent hidden, matching the established pack contract; SMS privacy guidance enables the explicit consent checkbox in the prepared campaign. Native checks verify it remains visible and required. The design revision was recorded with `templates:record`.

The lamp's existing original SVG has a reviewed 960 × 800 PNG derivative for portable/offline installation. See `task-lamp-export.md`. No renderer, frontend runtime or existing template artwork was changed. The new derivative is used only by the pack exporter: the conservative scope planner flags the assets directory, but existing prepared campaign revisions remain unchanged. No unrelated stale approvals were refreshed.

## Evidence and limits

`proof.json` binds each selected setup's current revision to all twenty screens at four studio widths and two WordPress widths, with screenshot hashes. The existing `checkProof` validator is used against this explicit cross-batch selection under a temporary in-memory batch label; source batch membership and release gates are unchanged. Additional closeups, RTL/long-copy and short-height evidence are retained alongside the ledger.

All data is fictional. WordPress is the disposable local Playground at port 9463 with rebuilt Free/Pro loaders and phone assets. No existing customer campaign was changed. External email/SMS delivery and physical-device testing were not performed. Event dates, product facts, destinations, resources and providers remain merchant configuration. Approval does not assert measured conversion improvement.
