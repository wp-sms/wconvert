# 0151: A draft preview shows now

Date: 2026-10-17. Status: accepted.
Amends [0048](0048-the-eligibility-inspector-runs-on-the-real-page.md).
Delivers #281.

The builder's Preview dialog draws a design on a blank canvas. A merchant
planning Black Friday in October also wants to see the bar on their own theme,
over their own header, before they publish it. The inspector cannot do that: it
explains the published set, and a draft is not in it.

## Decisions

**1. `?wconvert-preview=<id>` shows that campaign's saved draft, now, on any
page.** Only a user with `Routes::MANAGE_CAPABILITY` gets it; anyone else
gets the ordinary page. An id that is not a ULID, names no campaign, or names a
deleted one also gives the ordinary page, with no error.

**2. The draft is rewritten, then projected like any published row.**
`DraftPreview::shownNow()` removes the schedule and the content lock, sets
Targeting to every page and the display plan to Everyone, opening immediately.
It sets a frequency that a dismissal or a submission cannot stop. The rule a
cart Goal adds (a cart with items) is dropped after the projection. The
rewritten row then goes through `PublishedProjection::build()`, so the browser
gets the same shape a live campaign gets.

We rejected a preview mode in the loader. It would cost the free loader bytes
on every page view to serve one administrator, and a second path through
`decide()` is the drift ADR 0048 refused for the inspector.

**3. The preview replaces the set for that request.** `LoaderEnqueue` asks
`DraftPreview` first. While a preview is active its one-entry set is the only
thing printed, so live campaigns do not compete with it for the screen. An
`inline` campaign also gets an anchor at the end of the page, so it shows on a
page without its block. Where the page has the block, the block's anchor comes
first and is used.

**4. A preview records nothing.** It prints no beacon URL, no capture URL and
no site allowance, and Pro's analytics is not told the entries. A submit shows
the form's own "not confirmed" state. The routes would refuse a draft's id
anyway, but a live campaign's unpublished edits use the live id, so the
capture URL is blank for every preview.

**5. It is never cached.** `nocache_headers()` and `DONOTCACHEPAGE` are set on
`template_redirect`, while headers can still be sent.

**6. The admin offers it as "Preview on site".** It is in the campaign list's
row menu and in the editor's campaign actions. The editor offers it only once
the draft is saved and has a design, because the site shows the saved draft.
The parameter's name travels from PHP as `previewParam`, as `inspectParam`
does.
