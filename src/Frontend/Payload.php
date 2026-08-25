<?php

namespace WConvert\Frontend;

use WConvert\Targeting\RequestContext;
use WConvert\Targeting\Targeting;
use WConvert\Targeting\TargetingEvaluator;

defined('ABSPATH') || exit;

/**
 * The published set, narrowed to this request.
 *
 * PHP walks the projections, evaluates ONLY the Targeting axis, and the
 * survivors are what the page carries — so a site with 40 Optins does not ship
 * 40 rule sets on every page (ADR 0003). Everything else is the loader's job.
 *
 * **There is deliberately no per-URL cache underneath this.** The full-page
 * cache is the cache. A transient keyed by URL would cache something already
 * cached and add an invalidation surface that will eventually be wrong. Every
 * WordPress developer's instinct is to add one; don't.
 *
 * @since 0.1.0
 */
final class Payload
{
    /**
     * @param iterable<array<string, mixed>> $publishedSet
     * @return list<array<string, mixed>>
     */
    public static function forRequest(iterable $publishedSet, RequestContext $context): array
    {
        $entries = [];

        foreach ($publishedSet as $projection) {
            $targeting = $projection['targeting'] ?? [];

            if (!TargetingEvaluator::matches(Targeting::fromArray(is_array($targeting) ? $targeting : []), $context)) {
                continue;
            }

            $payload = $projection['payload'] ?? [];

            // The Targeting axis is STRIPPED, not shipped. It was answered on
            // the server; sending it would pay for it twice and hand the
            // browser a rule it has no reason to be able to re-evaluate
            // (ADR 0005).
            $entries[] = ['id' => (string) ($projection['id'] ?? '')] + (is_array($payload) ? $payload : []);
        }

        return $entries;
    }
}
