<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The designs a free install can see and cannot use — as metadata, with no
 * tree anywhere in it.
 *
 * ============================================================================
 * SHIPPING THE TREE AND REFUSING THE SAVE IS TRIALWARE.
 * ============================================================================
 * Issue #7 states it plainly: *"if the free ZIP ships exit-intent code and
 * refuses to run it, that is trialware"*. A premium design is **absent** from
 * the free artifact rather than present-and-guarded, which is ADR 0015's
 * enforcement-by-non-registration applied to the library — and
 * `bin/verify-artifact-contract.sh` is what proves it per release rather than
 * per reviewer.
 *
 * So what is bundled is the card and not the design: a name, its Display Type,
 * the facets that let it sit in the same filtered grid as everything else, and
 * a link to a live preview on wconvert.com. No tree, no tokens, **and no
 * thumbnail** — ADR 0010's *no static thumbnails anywhere* is untouched here,
 * because a locked card carries no image at all.
 *
 * **Bundled, never fetched.** `availability.ts` already gives the reason for
 * upsell copy and it is the same reason: a free wp.org plugin phoning home for
 * advertising copy is a different conversation with the review team
 * (ADR 0015). The ticket that adds a *fetched* source adds it for free designs
 * and for Pro's premium trees, and never for this.
 *
 * ============================================================================
 * A PRO INSTALL SEES NONE OF THIS, AND NOT BECAUSE OF A CHECK HERE.
 * ============================================================================
 * Pro registers the real trees through the same {@see TemplateSource} seam, so
 * a stub whose id a real entry already holds is dropped by
 * {@see TemplateLibrary::locked()}. A paying customer is never shown an
 * advertisement for what they bought, and that falls out of the id rather than
 * out of a tier test somebody has to remember to write (ADR 0026).
 *
 * @since 0.1.0
 */
final class LockedTemplates implements TemplateSource
{
    public const PATH = 'resources/templates/locked.json';

    public function __construct(
        private readonly string $pluginDir = WCONVERT_DIR,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function entries(): array
    {
        $decoded = JsonFile::read(rtrim($this->pluginDir, '/') . '/' . self::PATH);
        $designs = $decoded['designs'] ?? null;

        if (!is_array($designs)) {
            return [];
        }

        return array_values(array_filter($designs, 'is_array'));
    }
}
