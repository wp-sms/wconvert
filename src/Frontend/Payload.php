<?php

namespace WConvert\Frontend;

use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;
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
     * @param iterable<PublishedOptin> $publishedSet
     * @return list<array<string, mixed>>
     */
    public static function forRequest(iterable $publishedSet, RequestContext $context): array
    {
        $entries = [];

        foreach ($publishedSet as $optin) {
            if (TargetingEvaluator::matches($optin->targeting, $context)) {
                $entries[] = $optin->toPayloadEntry();
            }
        }

        return $entries;
    }
}
