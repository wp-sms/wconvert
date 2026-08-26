<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Rules\Degradation;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\Tier;

/**
 * The degradation resolver, as it stands on an install supplying given tiers.
 *
 * A helper rather than a fake, and the distinction matters: {@see SuppliedRules}
 * is the real registry with the real manifest behind it, filled the same way
 * the two service providers fill it. What a test chooses is which plugins ran —
 * which is the only variable there is (ADR 0015).
 *
 * `free()` is therefore a free install and `withPro()` is a Pro one, exactly.
 */
final class InstalledRules
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    public static function vocabulary(): RuleVocabulary
    {
        return RuleVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    /** Free's provider registered its tier, and nothing else did. */
    public static function free(?RuleVocabulary $vocabulary = null): Degradation
    {
        return self::supplying($vocabulary ?? self::vocabulary(), Tier::Free);
    }

    /** And [[Pro]]'s provider added its own on top. */
    public static function withPro(?RuleVocabulary $vocabulary = null): Degradation
    {
        return self::supplying($vocabulary ?? self::vocabulary(), Tier::Free, Tier::Pro);
    }

    private static function supplying(RuleVocabulary $vocabulary, Tier ...$tiers): Degradation
    {
        $supplied = new SuppliedRules();

        foreach ($tiers as $tier) {
            $supplied->add(...$vocabulary->typesAt($tier));
        }

        return new Degradation($vocabulary, $supplied);
    }
}
