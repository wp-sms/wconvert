<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * Whether this install can run question journeys — questions, results,
 * screen conditions and flexible paths ({@see CaptureJourney::requiresPremium()}).
 *
 * ============================================================================
 * A CAPABILITY PRO REGISTERS, NEVER A TIER FREE ASKS ABOUT.
 * ============================================================================
 * Free answers "no" and nothing in free can change that. Pro's provider adds
 * to {@see self::FILTER} when its `journeys` module shipped, so the yes arrives
 * with the code that runs a journey and is absent wherever that code is
 * (ADR 0015, ADR 0116). Free's publish refusal, capture refusal, suspension,
 * pack validator and builder all ask this one question, and none of them names
 * a tier or a product.
 *
 * A filter rather than a container registry because two readers are static —
 * the admin's boot data and the shipping pack validator — and a filter is the
 * registry WordPress already has.
 *
 * **The bypass is named and accepted**, as ADR 0015 accepts copying the Pro
 * loader: a third plugin returning true here makes free publish a journey its
 * own loader cannot draw. That breaks the site that did it and nobody else.
 */
final class JourneySupport
{
    public const FILTER = 'wconvert_journeys';

    public static function active(): bool
    {
        // The literal, not self::FILTER, so the prefix is visible to a reviewer.
        return apply_filters('wconvert_journeys', false) === true;
    }
}
