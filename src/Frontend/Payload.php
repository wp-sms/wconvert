<?php

namespace WConvert\Frontend;

use WConvert\Optin\PublishedOptin;
use WConvert\Rules\Degradation;
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
 * ============================================================================
 * AND THIS IS WHERE AN OPTIN DEGRADES OR STOPS BEING SHOWN.
 * ============================================================================
 * ADR 0012 puts the second call site of the degradation resolver at asset
 * enqueue, because entitlement is deliberately kept out of the stored
 * projection: the premium rule is still sitting in `published_config` when
 * [[Pro]] stops being loaded, and **`config` outlives the code that reads it**.
 * So an Optin authored with Pro and running without it is resolved HERE, on
 * the way to the page — a premium [[Trigger]] substituted, a premium
 * [[Condition]] dropped, and a [[Suspended]] Optin left out of the payload
 * altogether (ADR 0027).
 *
 * It belongs in this loop rather than as a second pass over the result,
 * because suspension decides MEMBERSHIP: building an entry only to throw it
 * away would leave this class's own claim — "what the page actually receives"
 * — false for exactly the Optins that are hardest to reason about.
 *
 * **And it is not an entitlement branch**, which matters because
 * `tests/unit/Contract/NoLicenceOnTheFrontEndTest.php` reads this file to make
 * sure it never becomes one. {@see Degradation} asks {@see \WConvert\Rules\SuppliedRules}
 * whether this install can EVALUATE a rule type, and the answer is which code
 * registered — not a licence, not a tier, not "is Pro loaded" (ADR 0015).
 *
 * @since 0.1.0
 */
final class Payload
{
    /**
     * @param iterable<PublishedOptin> $publishedSet
     * @return list<array<string, mixed>>
     */
    public static function forRequest(
        iterable $publishedSet,
        RequestContext $context,
        Degradation $degradation
    ): array {
        $entries = [];

        foreach ($publishedSet as $optin) {
            if (!TargetingEvaluator::matches($optin->targeting, $context)) {
                continue;
            }

            $entry = $degradation->intoPayload($optin->toPayloadEntry());

            // Null is a [[Suspended]] Optin: it exists and is published, and a
            // rule it depends on is not available here. It emits nothing —
            // **no [[Impression]] and no [[Conversion]], rather than zeroes
            // against a live denominator** — and it resumes on its own when
            // the dependency returns, because nothing about it was stored and
            // nothing was destroyed. The Optin list is where the merchant
            // reads why (ADR 0027).
            if ($entry !== null) {
                $plan = \WConvert\Rules\DisplayPlan::forRequest($entry['display_rules'], $context);
                if ($plan === null) continue;
                $entry['display_rules'] = $plan;
                $entries[] = $entry;
            }
        }

        return $entries;
    }
}
