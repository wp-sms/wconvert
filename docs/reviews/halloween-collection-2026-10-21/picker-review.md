# Final picker and code review

The real WordPress picker returns the Halloween collection with five members
when Pro is active, and four popup members in Free. Both reads leave campaigns
unchanged (`picker-results.json`). The goal-first interface correctly filters
the collection: four offer designs for Promote an offer, one signup design for
Grow my email list. The offer view is captured in `picker-offers.png`.

The compiled Halloween snapshot is published only after its five current setup
reviews and its own collection review pass. Existing collection snapshots are
retained because their renderer-bound review refresh predates this addition;
this change does not approve those unrelated revisions.

Spec review: no findings. Standards review: one nonblocking copy observation:
the midnight print's atmospheric headline leaves the discount in supporting
copy. This is an intentional exception to the generic headline guideline,
following the user's instruction to keep these five designs close to the
reviewed prototypes. No visitor design layout or original headline is changed.

Date-boundary tests use the shipped collection data: absent from featured on
31 August, all five available on 1 September and through 31 October, expired on
1 November. They also cover Free membership and the seasonal opt-out.
