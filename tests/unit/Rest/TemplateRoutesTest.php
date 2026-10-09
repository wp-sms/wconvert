<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Rest\Routes;
use WConvert\Rest\TemplateController;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WP_REST_Request;

/**
 * The index / tree split, which is the whole reason the picker can grow.
 *
 * ============================================================================
 * THE FAILURE IS A NUMBER NOBODY LOOKS AT, WHICH IS WHY IT IS ASSERTED.
 * ============================================================================
 * `GET /templates` returned every tree on every request. That is free at three
 * entries and is the picker's entire cost at forty — paid before the merchant
 * has read a card, and paid again on every builder load. The regression that
 * undoes it is one line: an `index()` that starts including `tree` again
 * because something downstream found it convenient. Nothing breaks. Every
 * screen still works. So it is asserted here rather than measured later, the
 * same argument `tests/js/admin-split.test.ts` makes about the bundle.
 */
#[CoversClass(TemplateController::class)]
final class TemplateRoutesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
    }

    /** @param array<string, mixed> $tree
     * @return array<string, mixed>|null
     */
    private static function consentIn(array $tree): ?array
    {
        $stack = $tree['steps'] ?? [];

        while ($stack !== []) {
            $node = array_pop($stack);
            if (!is_array($node)) {
                continue;
            }
            if (($node['type'] ?? null) === 'consent') {
                return $node;
            }
            foreach (\WConvert\Template\TemplateTree::childrenOf($node) as $child) {
                if (is_array($child)) {
                    $stack[] = $child;
                }
            }
        }

        return null;
    }

    private static function controller(bool|Tier $pro = false, bool $privacyDefaults = false): TemplateController
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);

        return new TemplateController(
            TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR),
            $vocabulary,
            new FakeProPresence($pro instanceof Tier ? $pro : ($pro ? Tier::Elite : Tier::Free)),
            $privacyDefaults ? new PrivacyGuidance(new FakeOptionStore()) : null
        );
    }

    /**
     * @return array<string, mixed>
     */
    private static function index(bool|Tier $pro = false): array
    {
        /** @var array<string, mixed> $data */
        $data = self::controller($pro)->index()->get_data();

        return $data;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function cards(bool|Tier $pro = false): array
    {
        /** @var list<array<string, mixed>> $cards */
        $cards = self::index($pro)['templates'];

        return $cards;
    }

    public function testReadsAndDraftPreparationShareTheManageCapability(): void
    {
        self::controller()->registerRoutes();

        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        $this->assertSame(['/templates/snapshot', '/templates', '/templates/trees'], array_column($routes, 'route'));

        foreach ($routes as $registered) {
            $this->assertSame(Routes::NAMESPACE, $registered['namespace']);
            $handler = $registered['args'][0] ?? $registered['args'];
            $this->assertSame($registered['route'] === '/templates/snapshot' ? 'POST' : 'GET', $handler['methods']);
            $this->assertSame([Routes::class, 'canManage'], $handler['permission_callback']);
        }
    }

    public function testPreparingATemplateCarriesCopyWithoutWritingAnOptin(): void
    {
        $request = new WP_REST_Request();
        $request->set_param('id', 'fieldwork');
        $request->set_param('source', 'centred-card');
        $request->set_param('template', [
            'tokens' => ['bg' => '#abcdef'],
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => 'My own headline'],
            ]]]]),
        ]);

        $prepared = self::controller()->snapshot($request);

        $this->assertInstanceOf(\WP_REST_Response::class, $prepared);
        $data = $prepared->get_data();
        $this->assertStringContainsString('My own headline', json_encode($data, JSON_THROW_ON_ERROR));
        $this->assertNotSame('#abcdef', $data['tokens']['bg']);
        $this->assertSame('split', $data['tree']['steps'][0]['content']['type']);
        $this->assertArrayNotHasKey('id', $data);
    }

    public function testPreparingANewDesignUsesTheCampaignPurposeForConsent(): void
    {
        $template = TemplateLibrary::fromDirectory(
            TemplateVocabulary::fromManifest(self::PLUGIN_DIR),
            self::PLUGIN_DIR
        )->find('fieldwork');
        $this->assertNotNull($template);

        $request = new WP_REST_Request();
        $request->set_param('id', 'fieldwork');
        $request->set_param('source', 'fieldwork');
        $request->set_param('goal', 'grow_email_list');
        $request->set_param('template', ['tree' => $template['tree'], 'tokens' => $template['tokens']]);

        $prepared = self::controller(privacyDefaults: true)->snapshot($request);

        $this->assertInstanceOf(\WP_REST_Response::class, $prepared);
        $data = $prepared->get_data();
        $consent = self::consentIn($data['tree']);
        $this->assertNotNull($consent);
        $this->assertFalse($consent['hidden'] ?? true);
    }

    public function testAnUnavailableTemplateCannotBePrepared(): void
    {
        $request = new WP_REST_Request();
        $request->set_param('id', 'not-a-template');
        $result = self::controller()->snapshot($request);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('wconvert_template_unavailable', $result->get_error_code());
    }

    /**
     * **The assertion the ticket exists for.** An index entry is what a card
     * needs to be drawn, filtered and counted, and nothing else.
     */
    public function testTheIndexCarriesNoTreeAndNoTokens(): void
    {
        foreach (self::cards() as $card) {
            $this->assertArrayNotHasKey('tree', $card, $card['id'] . ' shipped its design in the index');
            $this->assertArrayNotHasKey('tokens', $card, $card['id'] . ' shipped its tokens in the index');
        }
    }

    public function testEveryCardCarriesWhatTheGridDrawsItFrom(): void
    {
        foreach (self::cards() as $card) {
            foreach (['id', 'name', 'display_type', 'tier', 'availability', 'facets'] as $key) {
                $this->assertArrayHasKey($key, $card, $card['id'] . ' cannot be drawn without ' . $key);
            }
        }
    }

    /**
     * The words and the facet vocabulary travel with the index, because one
     * screen reads all three together and neither is a fact about the install.
     */
    public function testTheWordsAndTheFacetVocabularyTravelWithIt(): void
    {
        $index = self::index();

        $this->assertArrayHasKey('roles', $index['labels']);
        $this->assertArrayHasKey('facets', $index['labels']);
        $this->assertArrayHasKey('facetValues', $index['labels']);
        $this->assertSame(['shape', 'captures', 'has_image'], array_keys($index['facets']));
    }

    /**
     * ==========================================================================
     * A FREE INSTALL IS SENT NO PREMIUM DESIGN — NOT EVEN ITS CARD.
     * ==========================================================================
     * Shipping the tree and refusing the save is trialware (issue #7), and a
     * gallery of padlocks reads the same way to wp.org's reviewers (ADR 0116).
     * `locked.json` is still bundled; a free install's payload never carries it.
     */
    public function testAFreeInstallIsSentNoLockedDesign(): void
    {
        $locked = array_filter(self::cards(), static fn (array $c): bool => $c['availability'] === 'locked');

        $this->assertSame([], $locked);
    }

    /**
     * A paid install still sees the designs its rung lacks — a name, its facets
     * and a link to a live preview on wconvert.io — and never the design.
     */
    public function testAPaidInstallIsOfferedLockedCardsWithSomewhereToGo(): void
    {
        $locked = array_values(array_filter(self::cards(Tier::Basic), static fn (array $c): bool => $c['availability'] === 'locked'));

        $this->assertNotSame([], $locked, 'a paid install is shown no designs from the rungs above it');

        foreach ($locked as $card) {
            // The eight cards are the `display-types` module's, which is the
            // BOTTOM paid rung — so the upsell names the cheapest tier that
            // actually carries the design rather than the most expensive one
            // (ADR 0056). At launch every rung displays as "Pro" regardless.
            $this->assertSame(in_array($card['id'], ['cart-accessories', 'cart-additions'], true) ? 'elite' : 'basic', $card['tier']);
            $this->assertArrayNotHasKey('tree', $card);
            // Fullscreen (ADR 0098), decision-support and contextual enquiry
            // designs have no published marketing pages yet. Their cards
            // stay informational; never invent a preview URL for this test.
            if (in_array($card['id'], ['cart-accessories', 'cart-additions', 'fullscreen-editorial', 'fullscreen-split', 'fullscreen-poster', 'gift-edit', 'space-planner', 'kit-workbench', 'service-directory', 'project-route', 'reading-path', 'slide-in-question', 'session-card', 'split-notice', 'margin-note', 'sample-envelope', 'availability-note', 'inline-signpost', 'callback-slip', 'launch-index'], true)) {
                $this->assertEmpty($card['preview_url'] ?? null);
            } else {
                $this->assertNotEmpty($card['preview_url'] ?? null, $card['id'] . ' is locked with nowhere to send the merchant');
            }
        }
    }

    /** Every design free actually ships is `ready` — never `unavailable`. */
    public function testEveryBundledDesignIsReadyOnAFreeInstall(): void
    {
        $ready = array_values(array_filter(self::cards(), static fn (array $c): bool => $c['tier'] === 'free'));

        $this->assertNotSame([], $ready);

        foreach ($ready as $card) {
            $this->assertSame('ready', $card['availability'], $card['id'] . ' is not offered on the install that ships it');
        }
    }

    /**
     * **No design is ever `unavailable`.** No site capability makes a design
     * absent — there is no WooCommerce a `split` layout needs — so the third
     * state does not arise, and a surface will never have to decide whether to
     * hide or explain one (ADR 0026).
     */
    public function testNoDesignIsEverUnavailable(): void
    {
        foreach (self::cards() as $card) {
            $this->assertContains($card['availability'], ['ready', 'locked'], $card['id']);
        }
    }

    /**
     * ==========================================================================
     * A PAYING CUSTOMER IS NEVER SHOWN AN ADVERTISEMENT FOR WHAT THEY BOUGHT.
     * ==========================================================================
     * On this install Pro is loaded and ships nothing, which is the harder half
     * of the case: a stub whose real design is still absent must stay `locked`
     * rather than resolving to `ready` and drawing a card with no tree behind
     * it. The upsell disappears when Pro REGISTERS the design, by id collision,
     * and not when a licence flag flips.
     */
    public function testALoadedProDoesNotResolveAStubItDidNotShip(): void
    {
        $stubs = 0;

        foreach (self::cards(true) as $card) {
            if ($card['tier'] === 'free') {
                continue;
            }

            $stubs++;

            $this->assertSame('locked', $card['availability'], $card['id'] . ' resolved ready with no design behind it');
        }

        // The loop above asserted nothing at all when the cards moved rung and
        // the filter still named the old one — a vacuous pass on the exact
        // claim this test exists to make. It cannot go quiet again.
        $this->assertGreaterThan(0, $stubs, 'no premium card reached the assertion');
    }

    /** Interleaved, so a premium design is not an advertisement at the bottom. */
    public function testLockedCardsSitInOrderWithTheRest(): void
    {
        $ids = array_column(self::cards(), 'id');
        $sorted = $ids;
        sort($sorted);

        $this->assertSame($sorted, $ids);
    }

    private static function trees(string $ids): WP_REST_Request
    {
        $request = new WP_REST_Request('GET', '/wconvert/v1/templates/trees');
        $request->set_param('ids', $ids);

        return $request;
    }

    public function testTheTreeRouteAnswersOnlyWhatWasAskedFor(): void
    {
        /** @var array{templates: list<array<string, mixed>>} $data */
        $data = self::controller()->trees(self::trees('centred-card,offer-panel'))->get_data();

        $this->assertSame(['centred-card', 'offer-panel'], array_column($data['templates'], 'id'));

        foreach ($data['templates'] as $entry) {
            $this->assertArrayHasKey('tree', $entry);
            $this->assertArrayHasKey('tokens', $entry);
            $this->assertArrayNotHasKey('name', $entry, 'the index already said the name');
        }
    }

    /**
     * A locked id and an id this install never shipped behave identically:
     * absent from the answer, never an error. The card that asked keeps its
     * *"See this design"* link, which is what it had before it asked.
     */
    public function testAnIdWithNoDesignBehindItIsSimplyAbsent(): void
    {
        /** @var array{templates: list<array<string, mixed>>} $data */
        $data = self::controller()->trees(self::trees('slide-in-benefits,nothing-at-all,centred-card'))->get_data();

        $this->assertSame(['centred-card'], array_column($data['templates'], 'id'));
    }

    /**
     * The cap is on the RESPONSE, not on the picker: the grid asks for what is
     * near the viewport, and this is what stops a hand-written URL asking for
     * the whole library back through the route built to avoid sending it.
     */
    public function testItWillNotHandBackTheWholeLibraryInOneRequest(): void
    {
        $ids = implode(',', array_map(static fn (int $n): string => 'filler-' . $n, range(1, 40))) . ',centred-card';

        /** @var array{templates: list<array<string, mixed>>} $data */
        $data = self::controller()->trees(self::trees($ids))->get_data();

        // `centred-card` is past the cap, so it is not in the answer — which is
        // the assertion: the slice happens before the lookup, not after.
        $this->assertSame([], $data['templates']);
    }

    public function testAnEmptyAskIsAnEmptyAnswer(): void
    {
        /** @var array{templates: list<array<string, mixed>>} $data */
        $data = self::controller()->trees(self::trees(''))->get_data();

        $this->assertSame([], $data['templates']);
    }
}
