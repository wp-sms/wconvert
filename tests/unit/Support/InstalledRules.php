<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Rules\Degradation;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;
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
 *
 * **And which plugins ran includes the SITE's**, as of #36: a rule declaring a
 * [[SiteDependency]] is registered only where the site has it, because a rule
 * nothing can answer must read as unsupplied rather than as running (ADR 0027).
 * Both helpers default to a site WITH a store, so the tiers stay the variable
 * they were; {@see self::withProButNoStore()} is the case that separates them.
 */
final class InstalledRules
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    public static function vocabulary(): RuleVocabulary
    {
        return RuleVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    /** A site with a store — the default, so the TIER stays the only variable. */
    public static function store(): SitePresence
    {
        return new FakeSitePresence([SiteDependency::WooCommerce]);
    }

    /** Free's provider registered its tier, and nothing else did. */
    public static function free(?RuleVocabulary $vocabulary = null): Degradation
    {
        return self::supplying($vocabulary ?? self::vocabulary(), self::store(), Tier::Free);
    }

    /** And [[Pro]]'s provider added its own on top. */
    public static function withPro(?RuleVocabulary $vocabulary = null): Degradation
    {
        return self::supplying($vocabulary ?? self::vocabulary(), self::store(), Tier::Free, Tier::Pro);
    }

    /**
     * **[[Pro]] is running and the store is gone** — the case #36 exists to
     * close.
     *
     * Pro's provider registers every `tier: pro` type it can EVALUATE, and a
     * cart rule on a site with no WooCommerce is not one of those: nothing
     * writes the cart cookie, so the module would answer false forever. The
     * hole this replaced registered it anyway, which made the Optin *not
     * suspended*, therefore shown, therefore saying "you left 3 items in your
     * cart" to somebody who has never added anything.
     */
    public static function withProButNoStore(?RuleVocabulary $vocabulary = null): Degradation
    {
        return self::supplying($vocabulary ?? self::vocabulary(), new FakeSitePresence(), Tier::Free, Tier::Pro);
    }

    private static function supplying(RuleVocabulary $vocabulary, SitePresence $site, Tier ...$tiers): Degradation
    {
        $supplied = new SuppliedRules();

        foreach ($tiers as $tier) {
            $supplied->add(...$vocabulary->typesAt($tier, $site));
        }

        return new Degradation($vocabulary, $supplied);
    }
}
