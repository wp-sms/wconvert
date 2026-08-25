<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeProPresence;

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
    private static function catalogue(bool $hasPro = false): array
    {
        return (new RuleCatalogue(
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new FakeProPresence($hasPro)
        ))->all();
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

    public function testItCarriesAllThreeAxes(): void
    {
        $this->assertSame(['targeting', 'triggers', 'conditions'], array_keys(self::catalogue()));
    }

    /**
     * **The targeting picker covers all five prefixes**, plus the one visitor
     * predicate that lives on this axis only because the client cannot read
     * WordPress's HttpOnly auth cookie (CONTEXT.md, Targeting).
     */
    public function testTheTargetingPickerIsGivenEveryPrefix(): void
    {
        $this->assertSame(
            ['post', 'singular', 'archive', 'term', 'url', 'logged_in'],
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
            ['id' => 'mobile_only', 'label' => 'On mobile only', 'fixed' => ['in' => ['mobile']]],
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
}
