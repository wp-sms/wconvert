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
 * EVERY CANDIDATE CARRIES A TREE.
 * ============================================================================
 * A design this install did not get is never a candidate. The hosted index
 * shows it — installable, or as a locked Pro image card — from the catalogue's
 * own entries ({@see Catalog\TemplateCatalog}, ADR 0156), and it reaches this
 * seam only once installed, as validated files in uploads.
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
