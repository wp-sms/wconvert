<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleCatalogue;
use WConvert\Targeting\RoleRegistry;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Availability;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeRoleSource;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * The rule vocabulary as the builder receives it.
 *
 * The manifest itself is asserted next door in {@see RuleManifestParityTest}
 * and its words in {@see RuleLabelParityTest}; what is only visible here is
 * what this class ADDS, and both additions are decisions rather than plumbing.
 *
 * **[[Availability]] is resolved on the server**, so no surface recombines two
 * booleans in an order of its own (ADR 0026).
 *
 * **A `locked` type is still described.** The rules panel is a settings list
 * the merchant went hunting through, and such a list EXPLAINS a gap — silence
 * there is baffling. It is the creation flow's front door that hides one.
 * Filtering here would collapse the two surfaces into the one that is wrong
 * for this screen, and leave a merchant wondering where exit intent went.
 */
#[CoversClass(RuleCatalogue::class)]
final class RuleCatalogueTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private static function catalogue(bool $hasPro = false, bool $hasStore = true): array
    {
        return self::of($hasPro, $hasStore)->all();
    }

    private static function of(bool $hasPro, bool $hasStore = true): RuleCatalogue
    {
        return new RuleCatalogue(
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new FakeProPresence($hasPro ? Tier::Elite : Tier::Free),
            new FakeSitePresence($hasStore ? [SiteDependency::WooCommerce] : []),
            // Two sources, because the seam is the feature: WordPress's own
            // roles, and what a membership adapter would register beside
            // them. Neither is WordPress here.
            (new RoleRegistry())->add(
                new FakeRoleSource(['subscriber' => 'Subscriber', 'customer' => 'Customer']),
                new FakeRoleSource(['plan_gold' => 'Gold plan'])
            )
        );
    }

    /**
     * @param array<string, list<array<string, mixed>>> $catalogue
     * @return array<string, mixed>
     */
    private static function type(array $catalogue, string $axis, string $type): array
    {
        foreach ($catalogue[$axis] ?? [] as $described) {
            if (($described['type'] ?? null) === $type) {
                return $described;
            }
        }

        self::fail(sprintf('%s declares no %s', $axis, $type));
    }

    public function testItCarriesAllThreeAxesAndTheStartingPoints(): void
    {
        $this->assertSame(['targeting', 'triggers', 'conditions', 'bundles'], array_keys(self::catalogue()));
    }

    /**
     * **The targeting picker covers all five prefixes**, plus the two visitor
     * predicates that live on this axis only because the client cannot read
     * WordPress's HttpOnly auth cookie (CONTEXT.md, Targeting).
     *
     * The picker is given all seven and draws five: the visitor half is not a
     * list member and has no row to add, so `Who.tsx` reads those two off this
     * same catalogue for their LABELS and their controls and draws them as
     * fields. Which is why they belong here rather than being filtered out —
     * a screen cannot name a rule type of its own (`api.ts`).
     */
    public function testTheTargetingPickerIsGivenEveryPrefix(): void
    {
        $this->assertSame(
            ['post', 'singular', 'archive', 'term', 'url', 'role', 'logged_in'],
            array_map(static fn (array $type): string => (string) $type['type'], self::catalogue()['targeting'])
        );
    }

    /**
     * **Triggers and Conditions are two separate lists**, because a rule type
     * is one or the other and never both (CONTEXT.md, Condition). The builder
     * draws two lists, and this is what it draws them from.
     */
    public function testEachClientAxisHoldsOnlyItsOwnKind(): void
    {
        foreach (['triggers' => 'trigger', 'conditions' => 'condition'] as $axis => $kind) {
            foreach (self::catalogue(true)[$axis] as $type) {
                $this->assertSame($kind, $type['kind'], sprintf('%s holds a %s', $axis, (string) $type['kind']));
            }
        }
    }

    public function testAPremiumRuleIsLockedWithoutProAndReadyWithIt(): void
    {
        $this->assertSame('locked', self::type(self::catalogue(false), 'conditions', 'query_param')['availability']);
        $this->assertSame('ready', self::type(self::catalogue(true), 'conditions', 'query_param')['availability']);
    }

    public function testAFreeRuleIsReadyWhateverTheInstallHas(): void
    {
        $this->assertSame('ready', self::type(self::catalogue(false), 'conditions', 'device')['availability']);
    }

    /**
     * The words are PHP's so `wp i18n make-pot` can see them (ADR 0013), and
     * this is where they meet the data again.
     */
    public function testEveryTypeParamAndPresetArrivesNamed(): void
    {
        $device = self::type(self::catalogue(), 'conditions', 'device');

        $this->assertSame('Device', $device['label']);
        $this->assertSame('Shows on', $device['params']['in']['label']);
        $this->assertSame(
            [
                ['value' => 'mobile', 'label' => 'Mobile'],
                ['value' => 'tablet', 'label' => 'Tablet'],
                ['value' => 'desktop', 'label' => 'Desktop'],
            ],
            $device['params']['in']['options']
        );
        $this->assertSame(
            [
                'id' => 'mobile_only',
                'label' => 'On mobile only',
                // The same preset read inside a sentence rather than over a
                // control — "Fires ... on mobile", never "Fires On mobile only".
                'phrase' => 'they are on mobile',
                'fixed' => ['in' => ['mobile']],
            ],
            $device['presets'][0]
        );
    }

    /**
     * A `post_type`'s options are a fact about the INSTALL — a custom post
     * type's label is whatever its author registered — so they come from
     * WordPress rather than from a list of ours.
     */
    public function testPostTypeOptionsComeFromWordPress(): void
    {
        $this->assertSame(
            [['value' => 'post', 'label' => 'Post'], ['value' => 'page', 'label' => 'Page']],
            self::type(self::catalogue(), 'targeting', 'singular')['params']['value']['options']
        );
    }

    /**
     * **The selector is author-only** (ADR 0012). The flag travels so the
     * panel can say so beside the control; what it DECIDES is that a
     * [[Playbook]] may not supply one, which is settled at registration.
     */
    public function testAnAuthorOnlyParamSaysSo(): void
    {
        $this->assertTrue(self::type(self::catalogue(true), 'triggers', 'click_element')['params']['selector']['authored']);
        $this->assertFalse(self::type(self::catalogue(), 'triggers', 'time_on_page')['params']['seconds']['authored']);
    }

    // ========================================================================
    // AND THE SITE HALF, WHERE `unavailable` BEATS `locked` (ADR 0026).
    // ========================================================================

    /**
     * **A paying customer is never shown an upsell**, and the mirror of it:
     * a merchant with no store is never sold [[Pro]] for a feature Pro would
     * not give them either. A cart [[Condition]] on a Pro install with no
     * WooCommerce is `unavailable`, not `ready` — Pro cannot make a cart out
     * of nothing.
     */
    public function testACartConditionIsUnavailableWithoutAStoreEvenOnPro(): void
    {
        $this->assertSame(
            Availability::Unavailable,
            self::of(true, false)->availabilityOf('cart_has_items')
        );
    }

    /**
     * The precedence, from the side where both reasons apply at once. A free
     * install with no store could be told either thing, and `locked` is the
     * one that offers to sell a licence for a feature the buyer still could
     * not use.
     */
    public function testUnavailableBeatsLockedWhenBothReasonsApply(): void
    {
        $this->assertSame(
            Availability::Unavailable,
            self::of(false, false)->availabilityOf('cart_value_min')
        );
    }

    /** With both halves present it is simply usable. */
    public function testACartConditionIsReadyOnProWithAStore(): void
    {
        $this->assertSame(Availability::Ready, self::of(true)->availabilityOf('cart_has_items'));
    }

    /**
     * A store and no Pro is the one cart case that IS buyable from us, so it
     * is the one that may carry an upsell.
     */
    public function testACartConditionIsLockedOnFreeWithAStore(): void
    {
        $this->assertSame(Availability::Locked, self::of(false)->availabilityOf('cart_has_items'));
    }

    /**
     * A rule needing nothing of the site is never `unavailable`, whatever the
     * install is missing — otherwise every install without WooCommerce would
     * lose `exit_intent`'s upsell too.
     */
    public function testARuleThatNeedsNothingOfTheSiteIsNeverUnavailable(): void
    {
        $this->assertSame(Availability::Locked, self::of(false, false)->availabilityOf('exit_intent'));
        $this->assertSame(Availability::Ready, self::of(false, false)->availabilityOf('device'));
    }

    /**
     * **The dependency is NAMED**, because "not available on this site" leaves
     * a merchant who deactivated WooCommerce to guess which of their plugins
     * did it ({@see \WConvert\Optin\Suspension} is what turns it into a
     * sentence).
     */
    public function testTheCatalogueSaysWhichPluginTheSiteIsMissing(): void
    {
        $noStore = self::of(true, false);

        $this->assertSame(SiteDependency::WooCommerce, $noStore->missingDependencyOf('cart_has_items'));
        $this->assertSame(SiteDependency::WooCommerce, $noStore->missingDependencyOf('cart_value_min'));
        $this->assertNull($noStore->missingDependencyOf('exit_intent'));
        $this->assertNull($noStore->missingDependencyOf('nonsense'));
    }

    /**
     * **A rule whose dependency the site HAS names nothing**, even though it
     * declares one. That rule is `locked` on a free install, and the sentence
     * for `locked` is the one that may mention Pro — so a catalogue that
     * answered "WooCommerce" here would tell a merchant with a perfectly good
     * store to go and install one.
     */
    public function testARuleWhoseDependencyIsPresentNamesNothing(): void
    {
        $this->assertNull(self::of(false)->missingDependencyOf('cart_has_items'), 'locked, not unavailable');
        $this->assertNull(self::of(true)->missingDependencyOf('cart_has_items'), 'ready');
    }

    /**
     * **The invariant that lets {@see \WConvert\Optin\Suspension} hold one
     * field instead of two**: `unavailable` is what a MISSING dependency
     * produces, so there is never an `unavailable` rule with nothing to name.
     * Asserted over every type the manifest declares rather than the two that
     * happen to have one, so a future rule that broke it fails here rather
     * than shipping a row that says "Suspended" and nothing else.
     */
    public function testUnavailableAlwaysHasADependencyToName(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        foreach ([self::of(true, false), self::of(false, false), self::of(true), self::of(false)] as $catalogue) {
            foreach (array_keys($vocabulary->axes()) as $axis) {
                foreach ($vocabulary->axes()[$axis] as $type) {
                    if ($catalogue->availabilityOf($type) === Availability::Unavailable) {
                        $this->assertNotNull($catalogue->missingDependencyOf($type), $type);
                    }
                }
            }
        }
    }

    /**
     * **A rule the site cannot serve is still DESCRIBED.** The rules panel is
     * a settings list the merchant went hunting through, and such a list
     * explains a gap; it is the creation flow's front door that hides one
     * (ADR 0026). Filtering here would leave a merchant who deactivated
     * WooCommerce wondering where their cart rules went.
     */
    public function testACartConditionIsDescribedEvenWithNoStore(): void
    {
        $described = self::type(self::catalogue(true, false), 'conditions', 'cart_has_items');

        $this->assertSame('unavailable', $described['availability']);
        $this->assertSame('Has something in their cart', $described['label']);
    }

    /**
     * **And it NAMES what is missing**, which is what stops the rules panel and
     * the Optin list disagreeing.
     *
     * {@see \WConvert\Optin\Suspension::reason()} already tells this same
     * merchant *"the “Has something in their cart” rule needs WooCommerce"*.
     * Without this key the panel holding the rule could say only "not
     * available", which is the sentence ADR 0026 rejects on the list for
     * leaving them to guess which of their plugins did it.
     */
    public function testAnUnavailableRuleNamesTheDependencyItIsMissing(): void
    {
        $described = self::type(self::catalogue(true, false), 'conditions', 'cart_has_items');

        $this->assertSame('WooCommerce', $described['requires_label']);
    }

    /**
     * **`locked` names nothing**, because the cause is the tier and the tier is
     * ours to sell. The precedence is {@see Availability::of()}'s and is not
     * re-derived here: a rule declaring a dependency the site HAS is `locked`,
     * and a free install with a store must never be told it needs WooCommerce.
     */
    public function testALockedRuleNamesNoDependency(): void
    {
        $this->assertNull(self::type(self::catalogue(false), 'conditions', 'cart_has_items')['requires_label']);
        $this->assertNull(self::type(self::catalogue(false), 'triggers', 'exit_intent')['requires_label']);
    }

    /** And a rule that runs here has nothing to explain. */
    public function testAReadyRuleNamesNoDependency(): void
    {
        $this->assertNull(self::type(self::catalogue(true), 'triggers', 'page_load')['requires_label']);
    }

    /**
     * **Every described type carries the key**, present or null, so the admin
     * reads one shape. A key that appears only on the rules that need it is a
     * key the client has to test for existence AND for null.
     */
    public function testEveryDescribedTypeCarriesTheKey(): void
    {
        foreach ([self::catalogue(true, false), self::catalogue(false), self::catalogue(true)] as $catalogue) {
            foreach ($catalogue as $axis => $types) {
                // The Starting points are on the same response and are not
                // rule types; they carry the key too, but keyed by `id`.
                if ($axis === 'bundles') {
                    continue;
                }

                foreach ($types as $described) {
                    $this->assertArrayHasKey('requires_label', $described, $axis . '.' . $described['type']);
                }
            }
        }
    }
}
