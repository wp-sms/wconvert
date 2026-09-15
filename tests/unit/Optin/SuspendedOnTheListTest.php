<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\GoalRegistry;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\SiteFrequency;
use WConvert\Optin\Suspension;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Targeting\RoleRegistry;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\OptinDesign;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_REST_Request;
use WP_REST_Response;

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
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new MilestoneStore(new FakeOptionStore()
        ));
    }

    public function testCampaignPreviewsOnlyExposeRequestedSavedDesigns(): void
    {
        $id = $this->draft([]);
        $this->draft([]);
        $request = new WP_REST_Request();
        $request->set_param('ids', [$id]);
        $response = $this->controllerOn(false, true)->previews($request);
        self::assertInstanceOf(WP_REST_Response::class, $response);
        $data = $response->get_data();
        self::assertCount(1, $data);
        self::assertSame($id, $data[0]['id']);
        self::assertIsArray($data[0]['template']);
        self::assertArrayNotHasKey('config', $data[0]);
        self::assertArrayNotHasKey('published_config', $data[0]);
        $request->set_param('ids', array_fill(0, 13, $id));
        self::assertInstanceOf(\WP_Error::class, $this->controllerOn(false, true)->previews($request));
    }

    public function testCampaignPreviewsRejectInvalidInputAndExcludeDeletedDesigns(): void
    {
        $controller = $this->controllerOn(false, true);
        $request = new WP_REST_Request();
        foreach ([null, [], 'invalid', ['invalid'], [27]] as $ids) {
            $request->set_param('ids', $ids);
            self::assertInstanceOf(\WP_Error::class, $controller->previews($request));
        }
        $id = $this->draft([]);
        $this->optins->delete($id);
        $request->set_param('ids', [$id]);
        $response = $controller->previews($request);
        self::assertInstanceOf(WP_REST_Response::class, $response);
        self::assertSame([], $response->get_data());
    }

    public function testCampaignPreviewsRequireManagementPermission(): void
    {
        $this->controllerOn(false, true)->registerRoutes();
        $routes = array_values(array_filter($GLOBALS['wconvertTestRoutes'], fn ($route) => $route['route'] === '/optins/previews'));
        self::assertCount(1, $routes);
        self::assertSame([\WConvert\Rest\Routes::class, 'canManage'], $routes[0]['args']['permission_callback']);
    }

    /**
     * @param list<array<string, mixed>> $rules
     */
    private function draft(array $rules): string
    {
        return $this->optins->create('Spring sale', 'promote_offer', ['rules' => $rules, 'template' => OptinDesign::template()])->id;
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
        /** @var list<array<string, mixed>> $rows */
        $rows = $this->controllerOn($proLoaded, $hasStore)->index(new WP_REST_Request())->get_data();

        return $rows;
    }

    /**
     * The controller wired for an install described by the two facts that
     * decide [[Availability]] — shared by the list and the single read, so
     * neither can be asked about a different install than the other.
     */
    private function controllerOn(bool $proLoaded, bool $hasStore): OptinController
    {
        $templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $pro = new FakeProPresence($proLoaded ? Tier::Elite : Tier::Free);
        $site = new FakeSitePresence($hasStore ? [SiteDependency::WooCommerce] : []);
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        if (!$proLoaded) {
            $degradation = InstalledRules::free($vocabulary);
        } else {
            $degradation = $hasStore
                ? InstalledRules::withPro($vocabulary)
                : InstalledRules::withProButNoStore($vocabulary);
        }

        return new OptinController(
            $this->optins,
            $vocabulary,
            $templates,
            TemplateLibrary::fromDirectory($templates, self::PLUGIN_DIR),
            new GoalRegistry($pro, $site),
            $this->publishedSet,
            $degradation,
            new RuleCatalogue($vocabulary, $pro, $site, new RoleRegistry()),
            new SiteFrequency(new FakeOptionStore()),
            new MilestoneStore(new FakeOptionStore()),
            new \WConvert\Destination\DestinationStore(new FakeOptionStore()),
            new \WConvert\Destination\DestinationRegistry($pro, $site)
        );
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

    // ========================================================================
    // AND THE EDITOR ASKS THE SAME QUESTION OF ONE OPTIN.
    // ========================================================================

    /**
     * One Optin, as `GET /wconvert/v1/optins/{id}` answers it.
     *
     * @return array<string, mixed>
     */
    private function shown(string $id, bool $proLoaded): array
    {
        $request = new WP_REST_Request();
        $request->set_param('id', $id);

        $response = $this->controllerOn($proLoaded, true)->show($request);

        $this->assertInstanceOf(WP_REST_Response::class, $response);

        /** @var array<string, mixed> $row */
        $row = $response->get_data();

        return $row;
    }

    /**
     * **The builder's readiness panel is the only place an editor says whether
     * this Optin is on the site**, and `published_at` cannot answer that: a
     * suspended Optin *is* published and is on no page at all. Reading the
     * column alone would print *"Live"* over an Optin the site is holding back.
     *
     * Resolved from the same published set the list reads, so the two screens
     * cannot disagree about one row.
     */
    public function testTheEditorReadsTheSameSuspensionTheListDoes(): void
    {
        $id = $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $reason = $this->shown($id, false)['suspended'];

        $this->assertIsString($reason);
        $this->assertSame(self::suspensionOf($this->listedOn(false), $id), $reason);
    }

    /**
     * And it is present as null on an Optin that is running, for the reason the
     * list's is: a key that appeared only on the bad rows is a key the client
     * tests for existence, so "absent" and "not suspended" would be one thing
     * until the day a request half-failed.
     */
    public function testTheEditorAnswersTheQuestionEvenWhenTheAnswerIsNo(): void
    {
        $id = $this->publish([['type' => 'page_load']]);
        $row = $this->shown($id, false);

        $this->assertArrayHasKey('suspended', $row);
        $this->assertNull($row['suspended']);
    }

    public function testPublishingReturnsTheConfirmedSuspensionWithoutAnotherRead(): void
    {
        $id = $this->draft([['type' => 'click_element', 'selector' => '#buy']]);
        $request = new WP_REST_Request();
        $request->set_param('id', $id);
        $response = $this->controllerOn(false, true)->publish($request);

        $this->assertInstanceOf(WP_REST_Response::class, $response);
        $state = $response->get_data();
        $this->assertNotNull($state['published_at']);
        $this->assertIsString($state['suspended']);
        $this->assertFalse($state['has_unpublished_changes']);
        $this->assertSame($this->shown($id, false)['suspended'], $state['suspended']);
    }
}
