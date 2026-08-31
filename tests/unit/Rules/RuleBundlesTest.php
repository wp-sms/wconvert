<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleBundles;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * [[Starting point]]s: the bundled sets, and what this install makes of them.
 *
 * Two things are asserted, and both are decisions rather than plumbing. **A
 * bundle is as available as its least available rule**, because offering
 * "Rescue an abandoned cart" to a site with no store lands two rules that
 * suspend the Optin on the spot. **And a bundle names sections rather than
 * replacing everything**, because an Optin left with no [[Trigger]] can never
 * fire and the save route refuses one outright.
 */
#[CoversClass(RuleBundles::class)]
#[CoversClass(RuleCatalogue::class)]
final class RuleBundlesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * @return list<array<string, mixed>>
     */
    private static function bundles(bool $hasPro = true, bool $hasStore = true): array
    {
        return (new RuleCatalogue(
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new FakeProPresence($hasPro),
            new FakeSitePresence($hasStore ? [SiteDependency::WooCommerce] : [])
        ))->bundles();
    }

    /**
     * @param list<array<string, mixed>> $bundles
     * @return array<string, mixed>
     */
    private static function find(array $bundles, string $id): array
    {
        foreach ($bundles as $bundle) {
            if ($bundle['id'] === $id) {
                return $bundle;
            }
        }

        self::fail(sprintf('no Starting point called %s', $id));
    }

    public function testEveryBundleIsNamedAndDescribed(): void
    {
        foreach (self::bundles() as $bundle) {
            $this->assertNotSame('', $bundle['label'], (string) $bundle['id']);
            $this->assertNotSame('', $bundle['description'], (string) $bundle['id']);
        }
    }

    /**
     * **A bundle carries exactly the sections it names.** The client reads
     * "which axes does applying this replace" off the keys, so a bundle that
     * shipped an empty `conditions` would wipe the merchant's Conditions on
     * apply and a bundle missing a key it fills would leave them behind.
     */
    public function testABundleCarriesOnlyTheSectionsItFills(): void
    {
        $when = self::find(self::bundles(), 'after-a-read');

        $this->assertSame([['type' => 'time_on_page', 'seconds' => 15]], $when['triggers']);
        $this->assertArrayNotHasKey('conditions', $when);
        $this->assertArrayNotHasKey('targeting', $when);
        $this->assertArrayNotHasKey('frequency', $when);

        $who = self::find(self::bundles(), 'mobile-visitors');

        $this->assertSame([['type' => 'device', 'in' => ['mobile']]], $who['conditions']);
        $this->assertArrayNotHasKey('triggers', $who);
    }

    /**
     * **The split is the vocabulary's, not the author's.** The rules are
     * declared flat and partitioned by kind, so a bundle cannot file a
     * Condition under When by mistake (ADR 0005).
     */
    public function testAMixedBundleIsSplitByKindRatherThanByHand(): void
    {
        $cart = self::find(self::bundles(), 'rescue-a-cart');

        $this->assertSame([['type' => 'exit_intent']], $cart['triggers']);
        $this->assertSame([['type' => 'cart_has_items']], $cart['conditions']);
    }

    public function testATargetingBundleCarriesTargetingAndNoRules(): void
    {
        $where = self::find(self::bundles(), 'blog-posts-only');

        $this->assertSame(['include' => [['type' => 'singular', 'value' => 'post']]], $where['targeting']);
        $this->assertArrayNotHasKey('triggers', $where);
    }

    public function testAnAllowanceBundleCarriesTheAllowance(): void
    {
        $this->assertSame(['maxImpressions' => 1], self::find(self::bundles(), 'show-it-once')['frequency']);
    }

    // ========================================================================
    // AVAILABILITY: THE LEAST OF ITS RULES', AND ADR 0026'S PRECEDENCE INTACT.
    // ========================================================================

    public function testABundleOfFreeRulesIsReadyOnAFreeInstall(): void
    {
        $this->assertSame('ready', self::find(self::bundles(false), 'after-a-read')['availability']);
        $this->assertNull(self::find(self::bundles(false), 'after-a-read')['requires_label']);
    }

    public function testABundleHoldingAPremiumRuleIsLockedWithoutPro(): void
    {
        $bundle = self::find(self::bundles(false), 'on-the-way-out');

        $this->assertSame('locked', $bundle['availability']);
        $this->assertNull($bundle['requires_label'], 'the tier is the cause, and it is ours to sell');
    }

    /**
     * **`unavailable` beats `locked`, and it names the plugin.** The cart
     * bundle holds a premium Trigger AND a Condition needing WooCommerce, so
     * on a free store-less install both reasons apply — and a merchant with no
     * store must never be sold Pro for a feature Pro would not give them
     * either (ADR 0026).
     */
    public function testACartBundleIsUnavailableRatherThanLockedWithNoStore(): void
    {
        foreach ([self::bundles(true, false), self::bundles(false, false)] as $bundles) {
            $bundle = self::find($bundles, 'rescue-a-cart');

            $this->assertSame('unavailable', $bundle['availability']);
            $this->assertSame('WooCommerce', $bundle['requires_label']);
        }
    }

    public function testEverythingIsReadyOnAProInstallWithAStore(): void
    {
        foreach (self::bundles() as $bundle) {
            $this->assertSame('ready', $bundle['availability'], (string) $bundle['id']);
        }
    }

    /**
     * **No bundle names a rule type with an `authored` param at all.**
     *
     * An authored param names something only one site has — a post id, a CSS
     * selector, a cart total in the store's own currency — and a bundle is
     * written here, once, for every install. So it may not supply one, which
     * is the rule a [[Playbook]] is already held to (ADR 0012).
     *
     * The assertion is about the TYPE rather than about the value, because
     * leaving the param out is not the escape it looks like: a Starting point
     * landing `click_element` with no selector hands the merchant a Trigger
     * that can never fire, which is the failure ADR 0042 rule 3 asks to be
     * reported BEFORE the click rather than produced by one of our own
     * buttons.
     */
    public function testNoBundleNamesARuleOnlyOneSiteCouldConfigure(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $authored = array_filter(
            array_merge(...array_values($vocabulary->axes())),
            static fn (string $type): bool => $vocabulary->authoredParamsOf($type) !== []
        );

        $this->assertNotSame([], $authored, 'no authored param in the vocabulary, so this asserts nothing');

        foreach (RuleBundles::all() as $id => $bundle) {
            $this->assertSame(
                [],
                array_intersect(RuleBundles::typesIn($bundle), $authored),
                $id . ' lands a rule whose defining param a bundle may not supply'
            );
        }
    }

    /** Every rule a bundle names is one the vocabulary declares. */
    public function testEveryBundledRuleNamesAKnownType(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        foreach (RuleBundles::all() as $id => $bundle) {
            foreach (RuleBundles::typesIn($bundle) as $type) {
                $this->assertNotNull($vocabulary->kindOf($type), $id . ' names ' . $type);
            }
        }
    }
}
