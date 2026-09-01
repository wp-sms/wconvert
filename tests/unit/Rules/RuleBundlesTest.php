<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleBundles;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleLabels;
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

    /**
     * ========================================================================
     * A STARTING POINT'S NAME MAY NOT BE A PRESET'S NAME. THEY SHARE A SCREEN.
     * ========================================================================
     * The whole reason these are not called presets is that `preset` already
     * means a per-type shortcut, and *"two meanings of one word on one screen
     * is what the glossary exists to prevent"* (CONTEXT.md, Starting point).
     * That argument is worth nothing if the LABELS collide — and two of them
     * did, byte for byte: `Once they have read a while` and `Half way down the
     * page` were both a bundle and a `time_on_page` / `scroll_depth` preset,
     * rendering a few centimetres apart in the same panel.
     *
     * A Starting point names an OUTCOME; a preset names a rule setting. This is
     * what keeps them telling those apart.
     */
    public function testNoStartingPointWearsANameThatAlreadyMeansSomethingElse(): void
    {
        $taken = array_map('strtolower', [...array_values(RuleLabels::types()), ...array_values(RuleLabels::presets())]);

        $this->assertNotSame([], $taken, 'no vocabulary to collide with, so this asserts nothing');

        foreach (RuleBundles::all() as $id => $bundle) {
            $this->assertNotContains(
                strtolower((string) $bundle['label']),
                $taken,
                sprintf('the Starting point “%s” is already the name of a rule or a preset', $id)
            );
        }
    }

    /**
     * ========================================================================
     * A BUNDLE NAMES A PRESET; IT DOES NOT RETYPE ONE.
     * ========================================================================
     * `['type' => 'time_on_page', 'preset' => 'after_a_read']`, never
     * `['seconds' => 15]`. The manifest already says what `after_a_read`
     * fixes, and a second copy of 15 in PHP is a number that drifts the day
     * somebody retunes the preset — silently, because both are valid rules and
     * nothing compares them.
     *
     * Both directions. A preset that does not exist expands to nothing and
     * lands the type's bare general form, which is a Starting point that
     * quietly does less than it says.
     */
    public function testEveryNamedPresetIsOneTheManifestDeclares(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $named = 0;

        foreach (RuleBundles::all() as $id => $bundle) {
            foreach (is_array($bundle['rules'] ?? null) ? $bundle['rules'] : [] as $rule) {
                $preset = $rule['preset'] ?? null;

                if (!is_string($preset)) {
                    continue;
                }

                $this->assertArrayHasKey(
                    $preset,
                    $vocabulary->presetsOf((string) $rule['type']),
                    sprintf('%s names %s.%s, which the manifest does not declare', $id, $rule['type'], $preset)
                );

                $named++;
            }
        }

        $this->assertGreaterThan(0, $named, 'no bundle names a preset, so this asserts nothing');
    }

    /**
     * And a rule whose type HAS a preset fixing exactly those values must name
     * it rather than spell it — which is the direction that stops the copy
     * coming back one rule at a time.
     */
    public function testNoBundleSpellsOutWhatAPresetAlreadyFixes(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $spelled = [];

        foreach (RuleBundles::all() as $id => $bundle) {
            foreach (is_array($bundle['rules'] ?? null) ? $bundle['rules'] : [] as $rule) {
                if (isset($rule['preset'])) {
                    continue;
                }

                $params = $rule;
                unset($params['type']);

                foreach ($vocabulary->presetsOf((string) $rule['type']) as $preset => $fixed) {
                    if ($fixed === $params) {
                        $spelled[] = sprintf('%s spells out what %s.%s already fixes', $id, $rule['type'], $preset);
                    }
                }
            }
        }

        // Collected rather than asserted in the loop, because every rule left
        // written out is of a type with NO presets — `exit_intent`,
        // `cart_has_items`, `singular` — so an assertion inside would never
        // run and the test would pass by never looking.
        $this->assertSame([], $spelled, 'name the preset instead of copying what it fixes');
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
