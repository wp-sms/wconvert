# Automatic inline placement uses rendered content

Phase 3 of #165. All paid Pro tiers supply automatic placement; manual block
and shortcode placement remains Free. Goal-first campaign creation is unchanged.

## Stored contract and authoring

`config.inline_placement` is absent/null for manual placement. Automatic accepts
`{position: before_content|after_content}` or
`{position: after_paragraph, paragraph: 1..100, fallback: after_content|skip}`.
These are campaign settings, not Template fields. Existing Template JSON and
database schema are unchanged. Non-inline formats discard the setting. Changing
format clears it in the same undoable edit; another inline design preserves it.

Display rules offers a Placement section before page and audience targeting,
with manual/automatic placement, position, fallback and automatic priority.
Design contains neither placement settings nor a placement summary/Change link;
publish-review placement links open and focus the Display rules section.
The section supplies its heading once. Manual/automatic uses the shared native
radio choice treatment, without a second fieldset heading or decorative divider.
The Pro controls load only when that section is opened, not on Design arrival.
Enabling is explicit and
explains replacing triggers with page load. It preserves conditions, frequency,
schedule and exclusions. With unrestricted Pages it starts with posts only;
deliberate existing includes remain intact. Pages stays the single targeting
source. Default position is after content; paragraph fallback defaults there too.
Save and publish require page load as the sole automatic trigger. Manual
placement keeps its existing trigger flexibility. Existing campaigns never opt in
automatically, and reverting to manual never silently restores old triggers.

Free knows the stored vocabulary and explains absent Pro controls. Pro supplies
the lazily loaded controls, PHP insertion, and visitor selection, gated by the
module directory in every paid tier. Deactivating Pro stops automatic insertion;
manual embeds keep their normal behavior. A licence is never consulted.

## Rendered content, not stored articles

Classic themes use the main `the_content` boundary after shortcodes; block themes
use the main `core/post-content` render boundary. Insert only into queried,
unprotected singular posts/pages, not archives, feeds, excerpts, REST output,
previews, secondary/query loops or recursive content filtering. Known Elementor
and Divi content skips insertion. Arbitrary builders/custom templates are not
claimed compatible: use manual placement and check the real page.

The paragraph boundary scanner retains original bytes and counts only nonempty
top-level `<p>` elements, excluding nested groups/columns/quotes/lists/tables.
Comments and raw-text elements do not create paragraph boundaries. Ambiguous,
unbalanced or oversized markup is left untouched for paragraph placement.
Too few valid paragraphs appends after content or skips, as configured.
Before/after placement does not parse or rewrite article markup.

PHP outputs hidden candidates for all targeted published arms, not a server-side
winner. Existing PublishedSet/Payload targeting and degradation are reused;
there is no URL cache, saved-content mutation, new table, option or transient.
Each A/B arm gets a candidate at its own position and carries its family anchor.

## Selection and counting

Pro waits for the document so footer/sidebar manual anchors are known. A manual
anchor anywhere for the same campaign/family wins over automatic placement.
After A/B assignment and the normal browser eligibility decision, choose at most
one usable automatic candidate by priority descending, then stable id ascending.
Missing candidates do not starve lower-priority campaigns. Once mounted, that
winner keeps the automatic slot for the page view. Other manual forms remain
independent, as does the existing one-overlay contest.

Only the chosen candidate becomes the canonical inline anchor. It delegates to
the existing presenter, renderer, capture and viewport-based Impression path.
Losers stay hidden/empty and count nothing. No pre-eligibility geometry is reserved,
because it would create empty gaps for visitors who cannot see the campaign.
This is normal-flow insertion, not an overlay: it can shift content at initial
load, or later after consent/conditions become eligible. Page-load-only avoids
intentional scroll/delay triggers but does not promise zero CLS. Below-content
placement is the conservative default; verify a real page on mobile.

Readiness shows the automatic position and rejects incompatible triggers. The
real-page inspector uses the same selection and distinguishes missing automatic
locations from losing automatic priority; it does not call either an overlay loss.

## Budget, tests and boundaries

The first complete build measures 13,655 B gzip-9 at Elite (previously 13,344 B).
Move the hard per-build gate from 13,500 to 14,012 B (512 B) for placement
selection/manual precedence and DOM readiness. No bypass, warning mode or extra
visitor chunk. Free remains about 10.5 KB and contains no automatic runtime.
The `data-wconvert-auto` module marker guards that boundary in built artifacts.

Unit/integration coverage includes normalization, trigger refusal, unchanged
articles, malformed/nested HTML, repeated filtering, priority after eligibility,
manual precedence, A/B family anchors, authoring and inspector parity. Disposable
WordPress browser tests cover actual hook output, rendering and capture. No
claim is made that emulation replaces device-level accessibility testing.

Selectors, repeated placement, sidebar automation, content locking and dedicated
page-builder integrations remain future phases.
