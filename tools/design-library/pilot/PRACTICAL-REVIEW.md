# Practical review before a campaign is published

Review the actual prepared campaign, not just its first screen. A design approval
is separate from a configured-campaign approval. Save findings with the campaign
revision and renderer revision; rebuild and inspect again after the last edit.

1. **Visitor need:** name the real task, audience, placement and promised outcome.
   Ask only for information needed for that outcome. An optional preference must
   stay optional, and an enquiry must not claim an appointment is booked.
2. **Every route:** use the visitor buttons through every screen. Cover each
   conditional branch, fallback result, Back, skip, optional-channel refusal,
   and each acknowledgement. Direct screen tabs are for visual inspection only.
3. **Inputs:** try empty and invalid required fields, then valid details. Use the
   real phone picker; change countries, try invalid numbers, and preserve both
   country and canonical number through Back, resizing and a retry. Check select
   keyboard operation, long options, field labels and both reading directions.
4. **Failure and success:** simulate an unsuccessful submission before accepting
   it. Stay on the form, retain answers and allow a retry. Acknowledgements must
   describe acceptance accurately; they must not claim email/SMS delivery,
   registration, a booking or account approval that has not happened.
5. **Next action:** configure and open every real destination on a test site.
   Cover coupon validity, resource access without an unwanted signup gate,
   unavailable recommendation products and fallback links, empty/non-empty carts,
   actual sale deadlines, external registration and service enquiry follow-up.
   Studio sample links and setup notices are not evidence that these work.
6. **Final appearance:** inspect all screens, variants and error states on desktop
   and small phones, plus RTL and longer copy. Check hierarchy, spacing, line
   breaks, arrow placement, phone menus, focus, scrolling and contrast. Run the
   layout checks, but do not substitute their result for visual inspection.

The studio defaults the sample phone country to GB; shipping campaigns use the
configured site/field country. It sends no data and cannot prove provider delivery
or store behaviour. Complete the configured WordPress test before release.

The [disposable MySQL demo](../demo/README.md) provides real sample products,
coupons, pages, resources, capture and a local mail outbox. Its verifier records
per-campaign database evidence. Store that result alongside the studio revision
and screen evidence; it does not replace clicking the visitor's routes. Review
records must state separately what was simulated, tested through native REST,
observed in the browser, and left for a merchant's configured provider.
