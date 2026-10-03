<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * Where the library's entries come from.
 *
 * ============================================================================
 * ONE DIRECTORY WAS THE WHOLE STORY, AND THE PICKER OUTGREW IT.
 * ============================================================================
 * {@see TemplateLibrary::fromDirectory()} globbed
 * `resources/templates/library/*.json` with no filter and no seam, which is
 * exactly right for three entries in one ZIP and wrong for four things at once:
 * [[Pro]]'s own designs, the metadata for a design a free install may not have,
 * and — the ticket after this one — a set fetched from a WConvert-hosted index
 * and cached.
 *
 * So the glob became one implementation of this, and everything else composes
 * beside it. A source produces **decoded candidate entries**: {@see TemplateLibrary} normalises every one against the vocabulary
 * and refuses the ones that cannot convert, whatever produced them. That is
 * the structural property the fetched source needs. Remote packages first pass
 * Catalog\PackValidator for value, shape, media and size checks (ADR 0082);
 * normalization alone is not a remote-data security policy. Originally this was
 * the property the fetched source would need most — *content, never
 * capability*, structurally rather than by intention, which is the constraint
 * issue #7 recorded about a free ZIP that ships premium code and declines to
 * run it.
 *
 * ============================================================================
 * A CANDIDATE WITH NO `tree` IS A DESIGN THIS INSTALL DID NOT GET.
 * ============================================================================
 * That is the whole discriminator, and it is why locked metadata comes through
 * the same seam rather than through a second one. `resources/templates/locked.json`
 * carries a name, a Display Type, the design's facets and a link to a live
 * preview on wconvert.io, and no tree at all — because shipping premium trees
 * in the free ZIP and refusing the save is trialware (issue #7), and rendering
 * a real control `disabled` fires wp.org Guideline 9.
 *
 * **Bundled, never fetched**, for the reason `availability.ts` already gives
 * about upsell copy: a free wp.org plugin phoning home for advertising is a
 * different conversation with the review team (ADR 0015).
 *
 * @since 0.1.0
 */
interface TemplateSource
{
    /**
     * Candidate entries, decoded and otherwise untouched.
     *
     * Order is the source's own; {@see TemplateLibrary} sorts. An entry
     * arriving twice from two sources is a {@see \WConvert\Support\RejectionReason::DuplicateId},
     * which is what makes composing sources safe rather than last-one-wins.
     *
     * **Failure is an empty list, never a throw.** A source that cannot reach
     * its index degrades to the sources beside it, so an offline site sees the
     * bundled library rather than an error banner on every visit — ADR 0042
     * rule 2 forbids the banner, and a gallery is useful without the fetch.
     *
     * @return list<array<string, mixed>>
     */
    public function entries(): array;
}
