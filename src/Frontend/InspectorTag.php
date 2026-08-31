<?php

namespace WConvert\Frontend;

use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;
use WConvert\Targeting\TargetingExplainer;

defined('ABSPATH') || exit;

/**
 * The server half of the inspector, as a second JSON tag beside the payload.
 *
 * ============================================================================
 * A SECOND TAG, NOT A SECOND FIELD ON THE PAYLOAD.
 * ============================================================================
 * The payload is inlined into every matching page of a public, cacheable site
 * against a 2KB budget (ADR 0014). This is admin-only, param-gated and
 * uncached, and it carries Optin NAMES and the Targeting rules the payload
 * deliberately strips. Merging the two would put all of that on every
 * visitor's page the day somebody forgot a condition.
 *
 * ============================================================================
 * EVERY OPTIN, INCLUDING THE DRAFTS.
 * ============================================================================
 * The funnel's first gate is *published*, and it is the commonest answer of
 * all: a merchant asking "why doesn't my popup show" has very often not
 * published it. A screen built from the published set alone would be silent
 * about the likeliest cause, so this is built from the repository's summaries
 * — which return drafts, exclude soft-deleted rows, and are capped at 500.
 *
 * **Pure and WordPress-free**, like {@see PayloadTag} and
 * {@see TargetingExplainer}: it is handed rows, a context and the words, and
 * `esc_url` is not needed because there is no URL on it.
 *
 * @since 0.1.0
 */
final class InspectorTag
{
    public const ELEMENT_ID = 'wconvert-inspector';

    /**
     * @param list<array<string, string|null>> $summaries As `OptinRepository::summaries()` returns them.
     * @param array<string, string> $suspensions Optin id => the sentence, as `Suspension::reasonsIn()` returns them.
     * @param iterable<array<string, mixed>> $publishedSet The stored set, for the Targeting of what is published.
     * @param array<string, mixed> $labels
     */
    public static function render(
        array $summaries,
        array $suspensions,
        iterable $publishedSet,
        RequestContext $context,
        array $labels
    ): string {
        $json = json_encode(
            [
                'request' => self::request($context),
                'optins' => self::optins($summaries, $suspensions, $publishedSet, $context),
                'labels' => $labels,
            ],
            JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );

        if ($json === false) {
            return '';
        }

        // JSON_HEX_TAG for the reason PayloadTag needs it: an Optin NAME
        // containing `</script>` would otherwise close this element early and
        // turn the rest of the report into markup. Names are merchant input,
        // and this tag carries them where the payload does not.
        return sprintf(
            '<script type="application/json" id="%s">%s</script>',
            self::ELEMENT_ID,
            $json
        );
    }

    /**
     * The request as the server actually saw it.
     *
     * ========================================================================
     * SHOWN HONESTLY, INCLUDING THE FIELDS THAT ARE NULL.
     * ========================================================================
     * Half the real support tickets about Targeting are `path` being
     * `/blog/pricing` on a subdirectory install, or a 404 and a search page
     * having `isSingular: false` and `postId: null`. A panel that hid the
     * nulls would hide exactly the rows that answer those.
     *
     * This is also the reason the inspector runs on the real page rather than
     * from a URL the merchant types: `url_to_postid()` returns 0 for archives,
     * terms, the blog index and the shop page, so `archivePostType` would be
     * permanently null and the screen would confidently explain a page nobody
     * is on.
     *
     * @return array<string, mixed>
     */
    private static function request(RequestContext $context): array
    {
        return [
            'path' => $context->path,
            'isSingular' => $context->isSingular,
            'postId' => $context->postId,
            'postType' => $context->postType,
            'archivePostType' => $context->archivePostType,
            'termIds' => $context->termIds,
            'isLoggedIn' => $context->isLoggedIn,
        ];
    }

    /**
     * One row per Optin, in the order the list shows them.
     *
     * @param list<array<string, string|null>> $summaries
     * @param array<string, string> $suspensions
     * @param iterable<array<string, mixed>> $publishedSet
     * @return list<array<string, mixed>>
     */
    private static function optins(
        array $summaries,
        array $suspensions,
        iterable $publishedSet,
        RequestContext $context
    ): array {
        $targeting = [];

        foreach (PublishedOptin::fromSet($publishedSet) as $optin) {
            $targeting[$optin->id] = $optin->targeting;
        }

        $rows = [];

        foreach ($summaries as $summary) {
            $id = (string) ($summary['id'] ?? '');

            if ($id === '') {
                continue;
            }

            $rows[] = [
                'id' => $id,
                'name' => (string) ($summary['name'] ?? ''),
                'published' => ($summary['published_at'] ?? null) !== null,
                // The sentence the Optin list already shows, so the two
                // screens cannot disagree about why an Optin is suspended.
                'suspended' => $suspensions[$id] ?? null,
                // Null for a draft: there is no published Targeting to
                // evaluate, and an unpublished Optin has not reached the gate
                // this would answer.
                'targeting' => isset($targeting[$id])
                    ? TargetingExplainer::explain($targeting[$id], $context)
                    : null,
            ];
        }

        return $rows;
    }

}
