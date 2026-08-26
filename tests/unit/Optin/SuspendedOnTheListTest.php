<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\GoalRegistry;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\Suspension;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_REST_Request;

/**
 * =============================================================================
 * VISIBLE — THE HALF OF SUSPENSION THAT IS A SCREEN.
 * =============================================================================
 * *"The Optin list shows the state and its cause"* (ADR 0027), because this is
 * the screen a merchant actually looks at when something stopped working, and
 * an Optin that quietly does not show is a merchant with nowhere to ask.
 *
 * The cause is resolved from [[Availability]] rather than asserted, which is
 * what keeps ADR 0026's line intact: `locked` is buyable from us and
 * `unavailable` is not, and a screen that collapsed the two would offer a
 * merchant a WooCommerce licence we do not have.
 */
#[CoversClass(Suspension::class)]
#[CoversClass(OptinController::class)]
final class SuspendedOnTheListTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private PublishedSet $publishedSet;

    private OptinRepository $optins;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $this->publishedSet = new PublishedSet(new FakeOptionStore());
        $this->optins = new OptinRepository(
            new FakeConnection(),
            $this->publishedSet,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR)
        );
    }

    /**
     * @param list<array<string, mixed>> $rules
     */
    private function draft(array $rules): string
    {
        return $this->optins->create('Spring sale', 'grow_email_list', ['rules' => $rules])->id;
    }

    /**
     * @param list<array<string, mixed>> $rules
     */
    private function publish(array $rules): string
    {
        $id = $this->draft($rules);
        $this->optins->publish($id);

        return $id;
    }

    /**
     * The list exactly as `GET /wconvert/v1/optins` answers it, on an install
     * described by the two facts that decide [[Availability]].
     *
     * Two axes rather than one as of #36, and they are INDEPENDENT: [[Pro]]
     * can go while the store stays, and the store can go while Pro stays. The
     * second is the case that was live before — Pro registered every
     * `tier: pro` rule type unconditionally, so a cart rule read as supplied
     * on a site with no WooCommerce.
     *
     * @return list<array<string, mixed>>
     */
    private function listedOn(bool $proLoaded, bool $hasStore = true): array
    {
        $templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $pro = new FakeProPresence($proLoaded);
        $site = new FakeSitePresence($hasStore ? [SiteDependency::WooCommerce] : []);
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        if (!$proLoaded) {
            $degradation = InstalledRules::free($vocabulary);
        } else {
            $degradation = $hasStore
                ? InstalledRules::withPro($vocabulary)
                : InstalledRules::withProButNoStore($vocabulary);
        }

        $controller = new OptinController(
            $this->optins,
            $vocabulary,
            $templates,
            TemplateLibrary::fromDirectory($templates, self::PLUGIN_DIR),
            new GoalRegistry($pro, $site),
            $this->publishedSet,
            $degradation,
            new RuleCatalogue($vocabulary, $pro, $site)
        );

        /** @var list<array<string, mixed>> $rows */
        $rows = $controller->index(new WP_REST_Request())->get_data();

        return $rows;
    }

    /** @param list<array<string, mixed>> $rows */
    private static function suspensionOf(array $rows, string $id): ?string
    {
        foreach ($rows as $row) {
            if (($row['id'] ?? null) === $id) {
                return is_string($row['suspended'] ?? null) ? $row['suspended'] : null;
            }
        }

        return null;
    }

    /**
     * The state AND its cause, in one line. Named rather than described: an
     * Optin that does not show is a merchant asking *why*, and a list that
     * answered only the first half would be the screen that made them ask.
     */
    public function testTheListNamesTheSuspendedStateAndWhy(): void
    {
        $id = $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $reason = self::suspensionOf($this->listedOn(false), $id);

        $this->assertNotNull($reason);
        $this->assertStringContainsString('Suspended', $reason);
        $this->assertStringContainsString('WConvert Pro', $reason, 'the cause the merchant can act on');
    }

    /**
     * **Self-healing, with no repair step.** Nothing was stored, so the same
     * row answers differently the moment [[Pro]] is back — no republish, no
     * button to press, nothing to notice.
     */
    public function testTheSameRowResumesTheMomentProIsBack(): void
    {
        $id = $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $this->assertNotNull(self::suspensionOf($this->listedOn(false), $id));
        $this->assertNull(self::suspensionOf($this->listedOn(true), $id));
    }

    /** A degraded Optin is running, not suspended, and the list must not say otherwise. */
    public function testADegradedOptinIsNotSuspended(): void
    {
        $id = $this->publish([['type' => 'exit_intent']]);

        $this->assertNull(self::suspensionOf($this->listedOn(false), $id));
    }

    /**
     * **A draft is never suspended.** Suspension is a statement about what the
     * site is SERVING; an unpublished Optin is not being served at all, and
     * putting the word on one would call an author's unfinished work broken.
     */
    public function testAnUnpublishedOptinIsNeverCalledSuspended(): void
    {
        $id = $this->draft([['type' => 'click_element', 'selector' => '#buy']]);

        $this->assertNull(self::suspensionOf($this->listedOn(false), $id));
    }

    // ========================================================================
    // AND THE OTHER AXIS: THE DEPENDENCY THE SITE SUPPLIES (#36).
    // ========================================================================

    /**
     * **The live hole #36 closed.** [[Pro]] registers every `tier: pro` rule
     * type at boot, so on a Pro install with WooCommerce deactivated
     * `cart_has_items` used to read as SUPPLIED — therefore not suspended,
     * therefore shown, and the Optin said *"you left 3 items in your cart"* to
     * somebody who has never added anything. `on_absence: suspend` alone does
     * not close it, because the field only fires when the type is unsupplied.
     */
    public function testACartOptinIsSuspendedWhenTheStoreGoesEvenWithProRunning(): void
    {
        $id = $this->publish([['type' => 'page_load'], ['type' => 'cart_has_items']]);

        $reason = self::suspensionOf($this->listedOn(true, false), $id);

        $this->assertNotNull($reason, 'a cart Optin ran on a site with no cart');
        $this->assertStringContainsString('Suspended', $reason);
    }

    /**
     * **And it names WooCommerce rather than Pro.** `locked` is buyable from
     * us and `unavailable` is not, so a row that reached for the upsell here
     * would offer a paying customer a WConvert licence they already hold, for
     * a WooCommerce licence we do not sell (ADR 0026).
     */
    public function testTheCauseNamesTheMissingPluginAndNeverSellsPro(): void
    {
        $id = $this->publish([['type' => 'page_load'], ['type' => 'cart_has_items']]);

        $reason = (string) self::suspensionOf($this->listedOn(true, false), $id);

        $this->assertStringContainsString('WooCommerce', $reason);
        $this->assertStringNotContainsString('WConvert Pro', $reason);
    }

    /**
     * The same Optin on a free install with a store: the cause is the TIER,
     * which is the one cart case we may sell against.
     */
    public function testWithAStoreAndNoProTheCauseIsTheTier(): void
    {
        $id = $this->publish([['type' => 'page_load'], ['type' => 'cart_has_items']]);

        $reason = (string) self::suspensionOf($this->listedOn(false), $id);

        $this->assertStringContainsString('WConvert Pro', $reason);
    }

    /**
     * Both gone at once, and `unavailable` still beats `locked`. This is the
     * merchant who has neither, and the one a collapsed state would try to
     * sell Pro to for a feature Pro alone would not deliver.
     */
    public function testWithNeitherProNorAStoreTheCauseIsStillTheStore(): void
    {
        $id = $this->publish([['type' => 'page_load'], ['type' => 'cart_has_items']]);

        $reason = (string) self::suspensionOf($this->listedOn(false, false), $id);

        $this->assertStringContainsString('WooCommerce', $reason);
        $this->assertStringNotContainsString('WConvert Pro', $reason);
    }

    /**
     * **Self-healing on this axis too, with no repair step.** Reactivating
     * WooCommerce is a plugin screen and nothing else: nothing about the Optin
     * was stored, so the next request simply computes a different answer.
     */
    public function testTheSameRowResumesTheMomentTheStoreIsBack(): void
    {
        $id = $this->publish([['type' => 'page_load'], ['type' => 'cart_has_items']]);

        $this->assertNotNull(self::suspensionOf($this->listedOn(true, false), $id));
        $this->assertNull(self::suspensionOf($this->listedOn(true), $id));
    }

    /**
     * The two axes do not leak into each other. An Optin holding no cart rule
     * is untouched by the store going away, or every Optin on a site that
     * uninstalled WooCommerce would go dark at once.
     */
    public function testAnOptinWithNoCartRuleIsUnaffectedByTheStoreGoingAway(): void
    {
        $id = $this->publish([['type' => 'page_load'], ['type' => 'device', 'in' => ['mobile']]]);

        $this->assertNull(self::suspensionOf($this->listedOn(true, false), $id));
    }

    /** Every row carries the key, so "absent" and "not suspended" stay one thing. */
    public function testEveryRowAnswersTheQuestion(): void
    {
        $this->publish([['type' => 'page_load']]);
        $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        foreach ($this->listedOn(false) as $row) {
            $this->assertArrayHasKey('suspended', $row);
        }
    }
}
