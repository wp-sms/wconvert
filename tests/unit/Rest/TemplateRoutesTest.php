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
            new FakeProPresence($pro instanceof Tier ? $pro : ($pro ? Tier::Pro : Tier::Free)),
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

    /** Taken for Show a message, a click design leaves its counted link behind (ADR 0163). */
    public function testPreparingADesignForAMessageTakesItsCountedLinkOut(): void
    {
        $template = TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR)->find('offer-panel');
        $this->assertNotNull($template);
        $request = new WP_REST_Request();
        $request->set_param('id', 'offer-panel');
        $request->set_param('source', 'offer-panel');
        $request->set_param('template', ['tree' => $template['tree'], 'tokens' => $template['tokens']]);

        $request->set_param('goal', 'show_message');
        $prepared = self::controller()->snapshot($request);
        $this->assertInstanceOf(\WP_REST_Response::class, $prepared);
        $message = $prepared->get_data();
        $this->assertSame([], \WConvert\Template\ConvertingAct::offeredIn($message['tree']));

        $request->set_param('goal', 'promote_offer');
        $prepared = self::controller()->snapshot($request);
        $this->assertInstanceOf(\WP_REST_Response::class, $prepared);
        $offer = $prepared->get_data();
        $this->assertSame([\WConvert\Template\ConvertingAct::Click], \WConvert\Template\ConvertingAct::offeredIn($offer['tree']));
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
     * Without the hosted catalogue, a free install has no Pro design to name.
     */
    public function testAFreeInstallIsSentNoLockedDesign(): void
    {
        $locked = array_filter(self::cards(), static fn (array $c): bool => $c['availability'] === 'locked');

        $this->assertSame([], $locked);
    }

    /**
     * A hosted catalogue with one Free and one Pro design, read by a
     * controller on an install of `$tier`.
     *
     * @return array<string, array<string, mixed>> cards by id
     */
    private static function hostedCards(Tier $tier, bool $hints, ?\Closure $publish = null): array
    {
        $directory = sys_get_temp_dir() . '/wconvert-hosted-' . bin2hex(random_bytes(6));
        $http = new \WConvert\Tests\Unit\Template\Catalog\FakeCatalogTransport();
        $service = new \WConvert\Tests\Unit\Template\Catalog\CatalogFixture($http);
        $service->design('resources/templates/library/reading-slip.json', 'hosted-reading', 1, [], ['thumb' => str_repeat('c', 64)]);
        $service->design('pro/modules/display-types/templates/availability-note.json', 'hosted-note', 1, [], ['thumb' => str_repeat('d', 64), 'slug' => 'availability-note']);
        $service->design('resources/templates/library/reading-slip.json', 'reading-slip', 5);
        if ($publish !== null) $publish($service);
        $service->publish();
        $options = new FakeOptionStore();
        $options->set(\WConvert\Template\Catalog\TemplateCatalog::SOURCE_OPTION, \WConvert\Tests\Unit\Template\Catalog\CatalogFixture::SOURCE);
        $options->set(\WConvert\Template\Catalog\TemplateCatalog::CONSENT_OPTION, 'yes');
        $GLOBALS['wconvertTestTransients'] = [];
        $GLOBALS['wconvertTestCapabilities'] = $hints ? ['install_plugins'] : [];
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $validator = new \WConvert\Template\Catalog\PackValidator(\WConvert\Template\TemplateManifest::load(), $vocabulary, $tier);
        $catalog = new \WConvert\Template\Catalog\TemplateCatalog($options, $http, $validator,
            new \WConvert\Template\Catalog\DesignArchive($directory, $validator, 'secret'), $tier, static fn (): array => ['reading-slip' => 1]);
        try {
            $catalog->refresh();
            $data = (new TemplateController(TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR), $vocabulary, new FakeProPresence($tier), null, $catalog))->index()->get_data();
        } finally {
            $GLOBALS['wconvertTestCapabilities'] = [];
            exec('rm -rf ' . escapeshellarg($directory));
        }
        self::assertIsArray($data);
        return array_column($data['templates'], null, 'id') + ['_withdrawn' => (array) $data['withdrawn']];
    }

    /**
     * ==========================================================================
     * FREE MEETS A PRO DESIGN ONLY AS A LOCKED IMAGE CARD (ADR 0156).
     * ==========================================================================
     * A server thumbnail, the plan's name and a link to wconvert.io — never a
     * tree, never Apply — and only for someone who could install Pro. Without
     * the hint conditions the card is not sent at all (ADR 0147's gate).
     */
    public function testAFreeInstallSeesAProDesignOnlyAsALockedImageCard(): void
    {
        $cards = self::hostedCards(Tier::Free, true);
        $locked = $cards['remote:hosted-note'];
        $this->assertSame('locked', $locked['availability']);
        $this->assertArrayNotHasKey('tree', $locked);
        $this->assertSame('https://catalog.example/v3/thumbs/' . str_repeat('d', 64) . '.webp', $locked['remote']['thumbnail']['1x']);
        $this->assertStringStartsWith('https://wconvert.io/templates/availability-note/', $locked['preview_url']);
        $this->assertSame('install', $cards['remote:hosted-reading']['remote']['state']);
        $this->assertSame('ready', $cards['remote:hosted-reading']['availability']);

        $this->assertArrayNotHasKey('remote:hosted-note', self::hostedCards(Tier::Free, false), 'No hint, no card');
        $pro = self::hostedCards(Tier::Pro, true);
        $this->assertSame('ready', $pro['remote:hosted-note']['availability'], 'A Pro install installs it instead');
        $this->assertSame('install', $pro['remote:hosted-note']['remote']['state']);
    }

    /** A hosted revision above the bundled one is a line on the bundled card, not a second card. */
    public function testANewerHostedRevisionIsALineOnTheLocalCard(): void
    {
        $cards = self::hostedCards(Tier::Free, false);
        $this->assertArrayNotHasKey('remote:reading-slip', $cards);
        $this->assertSame(5, $cards['reading-slip']['newer_revision']['revision']);
    }

    /** A withdrawn design leaves the gallery; its local copy is named for the editor's notice. */
    public function testAWithdrawnBundledDesignLeavesTheGalleryAndIsNamed(): void
    {
        $cards = self::hostedCards(Tier::Free, false, static function ($service): void {
            $service->withdrawn = [['id' => 'reading-slip', 'reason' => 'rights']];
        });
        $this->assertArrayNotHasKey('reading-slip', $cards);
        $this->assertSame('rights', $cards['_withdrawn']['reading-slip']);
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

    /** Interleaved by design, so a hosted design is not an advertisement at the bottom. */
    public function testCardsSitInDesignOrder(): void
    {
        $ids = array_column(self::cards(), 'design_key');
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
