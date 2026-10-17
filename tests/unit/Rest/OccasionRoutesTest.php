<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Discovery\OccasionStore;
use WConvert\Discovery\PickerDocuments;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\SiteFrequency;
use WConvert\Rest\OccasionController;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
use WConvert\Targeting\RoleRegistry;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WConvert\Tests\Unit\Support\LeaseReleasingWpdb;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * A campaign belongs to an occasion (#276), and an occasion copies to next
 * year (#279) and travels as one document (#280, ADR 0153).
 *
 * The occasion routes create campaigns through `rest_do_request()`, which the
 * bootstrap hands to {@see OptinController::store()} here: the same refusals a
 * typed campaign meets, and nothing that could publish.
 */
#[CoversClass(OccasionController::class)]
#[CoversClass(OptinController::class)]
#[CoversClass(OccasionStore::class)]
final class OccasionRoutesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';
    private const FIXTURE = __DIR__ . '/../../fixtures/occasions/black-friday-2026.json';

    private OptinRepository $optins;
    private OptinController $controller;
    private TemplateVocabulary $templates;
    private TemplateLibrary $library;
    private FakeConnection $db;

    /** @var list<string> */
    private array $dispatched = [];

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestOptionTable'] = [];
        $GLOBALS['wpdb'] = new LeaseReleasingWpdb();
        \WConvert\Tests\Unit\Support\Journeys::on();

        $this->templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $published = new PublishedSet(new FakeOptionStore());
        $pro = new FakeProPresence(Tier::Pro);
        $site = new FakeSitePresence([SiteDependency::WooCommerce]);
        $milestones = new FakeOptionStore();
        // A Pro install's library, so the fixture's floating bar has its design.
        $this->library = TemplateLibrary::from(
            $this->templates,
            new \WConvert\Template\BundledTemplates(self::PLUGIN_DIR),
            new \WConvert\Pro\Template\ProTemplates(self::PLUGIN_DIR . '/pro'),
            new \WConvert\Template\LockedTemplates(self::PLUGIN_DIR),
        );

        $this->optins = new OptinRepository($this->db = new FakeConnection(), $published, $vocabulary, new MilestoneStore($milestones));
        $this->controller = new OptinController(
            $this->optins, $vocabulary, $this->templates, $this->library, new GoalRegistry($pro, $site), $published,
            InstalledRules::withPro($vocabulary), new RuleCatalogue($vocabulary, $pro, $site, new RoleRegistry()),
            new SiteFrequency(new FakeOptionStore()), new MilestoneStore($milestones),
            new \WConvert\Destination\DestinationStore(new FakeOptionStore()),
            new \WConvert\Destination\DestinationRegistry($pro, $site),
            new OccasionStore(),
        );
        $GLOBALS['wconvertTestRestServer'] = function (WP_REST_Request $request) {
            $this->dispatched[] = $request->get_method() . ' ' . $request->get_route();
            return $this->controller->store($request);
        };
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestRestServer'], $GLOBALS['wpdb']);
        $GLOBALS['wconvertTestOptionTable'] = [];
    }

    // ------------------------------------------------------------------
    // #276: a campaign belongs to an occasion
    // ------------------------------------------------------------------

    public function testACampaignLinksToAnOccasionThatExists(): void
    {
        $this->occasions([self::blackFriday()]);
        $draft = $this->create(['occasion' => 'black-friday-2026']);

        self::assertIsArray($draft);
        self::assertSame('black-friday-2026', $draft['config']['occasion']);
        self::assertSame('black-friday-2026', $this->row($draft['id'])['occasion']);
    }

    /** The occasion page draws each campaign's dates and format from the list alone. */
    public function testTheListCarriesEachCampaignsScheduleAndDisplayType(): void
    {
        $draft = $this->create(['starts_at' => '2026-11-20 00:00', 'ends_at' => '2026-12-02 00:00']);
        self::assertIsArray($draft);
        $row = $this->row($draft['id']);

        self::assertSame('2026-11-20 00:00', $row['starts_at']);
        self::assertSame('2026-12-02 00:00', $row['ends_at']);
        self::assertSame('popup', $row['display_type']);
    }

    public function testAnUnknownOccasionIsRefusedOnTheOccasionField(): void
    {
        $refused = $this->create(['occasion' => 'cyber-monday']);

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame('wconvert_optin_unknown_occasion', $refused->get_error_code());
        self::assertSame(['status' => 400, 'field' => 'occasion'], $refused->get_error_data());
    }

    /**
     * ADR 0149 §5: deleting the occasion writes no campaign. The list and the
     * editor read the link as gone, and the next save hands it back and has
     * it dropped rather than refused.
     */
    public function testDeletingTheOccasionDetachesOnReadAndTheNextSaveDropsIt(): void
    {
        $this->occasions([self::blackFriday()]);
        $draft = $this->create(['occasion' => 'black-friday-2026']);
        self::assertIsArray($draft);
        $writes = count($this->db->writes);

        $this->occasions([]);
        self::assertCount($writes, $this->db->writes, 'deleting an occasion writes no campaign');
        self::assertNull($this->row($draft['id'])['occasion']);
        $shown = $this->show($draft['id']);
        self::assertArrayNotHasKey('occasion', $shown['config']);

        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $request->set_param('config', ['occasion' => 'black-friday-2026'] + $draft['config']);
        $saved = $this->controller->update($request);
        self::assertNotInstanceOf(WP_Error::class, $saved, $saved instanceof WP_Error ? $saved->get_error_message() : '');
        self::assertArrayNotHasKey('occasion', $this->optins->find($draft['id'])->config ?? []);
    }

    // ------------------------------------------------------------------
    // #279: copy an occasion to next year
    // ------------------------------------------------------------------

    public function testCopyingMakesNextYearsOccasionWithLinkedDraftsAndLeavesTheOriginals(): void
    {
        $this->occasions([self::blackFriday()]);
        $original = $this->create([
            'occasion' => 'black-friday-2026', 'starts_at' => '2026-11-20 00:00', 'ends_at' => '2026-12-02 00:00',
            'analytics' => ['off' => false, 'label' => 'bf-2026-popup'],
        ], 'BF 2026 popup');
        self::assertIsArray($original);
        $this->create([], 'Not in the occasion');
        $before = $this->optins->find($original['id']);

        $reply = $this->copy('black-friday-2026');

        self::assertSame(['id' => 'black-friday-2027', 'name' => 'Black Friday 2027', 'start' => '2027-11-20', 'end' => '2027-12-01'], $reply['occasion']);
        self::assertSame([], $reply['failed']);
        self::assertCount(1, $reply['created']);
        self::assertSame('BF 2027 popup', $reply['created'][0]['name']);
        self::assertSame(['POST /wconvert/v1/optins'], $this->dispatched, 'the copy goes through the REST route');

        $copy = $this->optins->find($reply['created'][0]['id']);
        self::assertNotNull($copy);
        self::assertNull($copy->publishedAt, 'a copy is a draft');
        self::assertSame('black-friday-2027', $copy->config['occasion']);
        self::assertSame('2027-11-20 00:00', $copy->config['starts_at']);
        self::assertSame('2027-12-02 00:00', $copy->config['ends_at']);
        self::assertSame('', $copy->config['analytics']['label']);
        self::assertEquals($before, $this->optins->find($original['id']), 'the original is never written');
        self::assertSame(['black-friday-2026', 'black-friday-2027'], (new OccasionStore())->ids());
    }

    public function testCopyingTwiceFindsAFreeId(): void
    {
        $this->occasions([self::blackFriday()]);
        self::assertSame('black-friday-2027', $this->copy('black-friday-2026')['occasion']['id']);
        self::assertSame('black-friday-2027-2', $this->copy('black-friday-2026')['occasion']['id']);
    }

    /**
     * A deleted occasion's campaigns still carry its id, so the id is never
     * minted again: re-importing the same file must not take them back.
     */
    public function testADeletedOccasionsIdIsNeverGivenOutAgain(): void
    {
        $first = $this->import(self::fixture());
        self::assertSame('black-friday-2026', $first['occasion']['id']);
        $this->occasions([]);

        $again = $this->import(self::fixture());

        self::assertSame('black-friday-2026-2', $again['occasion']['id']);
        foreach ($first['created'] as $created) {
            self::assertNull($this->row($created['id'])['occasion'], 'the old campaigns stay detached');
        }
        $refused = (new OccasionStore())->write(static fn (array $items): array => [...$items, self::blackFriday()]);
        self::assertInstanceOf(WP_Error::class, $refused, 'the settings route cannot bring the id back either');
        self::assertSame(['black-friday-2026'], (new OccasionStore())->read()['retired']);
    }

    public function testCopyingAnOccasionThatDoesNotExistIs404(): void
    {
        $request = new WP_REST_Request();
        $request->set_param('id', 'nothing');
        $missing = $this->occasionController()->copy($request);
        self::assertInstanceOf(WP_Error::class, $missing);
        self::assertSame(404, $missing->get_error_data()['status']);
    }

    // ------------------------------------------------------------------
    // #280: an occasion travels as one document
    // ------------------------------------------------------------------

    public function testTheFixtureImportsAsFourLinkedDraftsWithItsWordsAndLink(): void
    {
        $reply = $this->import(self::fixture());

        self::assertSame('black-friday-2026', $reply['occasion']['id']);
        self::assertSame([], $reply['refused']);
        self::assertCount(4, $reply['created']);
        foreach ($reply['created'] as $created) {
            $optin = $this->optins->find($created['id']);
            self::assertNotNull($optin);
            self::assertNull($optin->publishedAt, 'an import never publishes');
            self::assertSame('black-friday-2026', $optin->config['occasion']);
        }
        $popup = $this->optins->find($reply['created'][1]['id']);
        self::assertSame('Black Friday popup', $popup?->name);
        $copy = SlotRoles::copyFrom($popup->config['template']['tree'], $this->templates);
        self::assertSame('Our biggest sale of the year', $copy['headline']);
        self::assertStringContainsString('"href":"\/black-friday\/"', (string) json_encode($popup->config['template']));
        self::assertSame('2026-11-10 00:00', $this->optins->find($reply['created'][3]['id'])?->config['starts_at']);
    }

    public function testExportThenImportRoundTrips(): void
    {
        $first = $this->import(self::fixture());
        $exported = $this->export('black-friday-2026');

        self::assertSame('wconvert-occasion', $exported['format']);
        self::assertCount(4, $exported['campaigns']);
        $byName = array_column($exported['campaigns'], null, 'name');
        self::assertEqualsCanonicalizing(array_column(self::fixture()['campaigns'], 'name'), array_keys($byName));
        foreach (self::fixture()['campaigns'] as $campaign) {
            $out = $byName[$campaign['name']];
            self::assertSame($campaign['design'], $out['design']);
            self::assertSame($campaign['display_type'], $out['display_type']);
            self::assertSame($campaign['link'], $out['link']);
            self::assertSame($campaign['starts_at'], $out['starts_at']);
            self::assertSame($campaign['ends_at'], $out['ends_at']);
            foreach ($campaign['copy'] as $role => $words) {
                self::assertSame($words, $out['copy'][$role], $campaign['name'] . ': ' . $role);
            }
        }

        $again = $this->import($exported);
        self::assertSame('black-friday-2026-2', $again['occasion']['id'], 'an id already taken is made unique');
        self::assertCount(4, $again['created']);
    }

    public function testADesignOutsideTheLibraryTravelsWhole(): void
    {
        $this->occasions([self::blackFriday()]);
        $template = json_decode((string) file_get_contents(self::PLUGIN_DIR . '/resources/templates/library/offer-panel.json'), true);
        $made = $this->create(['occasion' => 'black-friday-2026', 'template_id' => null, 'template' => ['tree' => $template['tree'], 'tokens' => $template['tokens']]]);
        self::assertIsArray($made);

        $exported = $this->export('black-friday-2026');
        self::assertNull($exported['campaigns'][0]['design']);
        self::assertSame($made['config']['template'], $exported['campaigns'][0]['template']);

        $exported['occasion']['id'] = 'elsewhere';
        $imported = $this->import($exported);
        self::assertCount(1, $imported['created']);
    }

    public function testAMalformedDocumentIs422AndWritesNothing(): void
    {
        $document = self::fixture();
        $document['campaigns'][2]['starts_at'] = '20 November';
        $document['campaigns'][0]['display_type'] = 'billboard';

        $refused = $this->occasionController()->import($this->importRequest($document));

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame(422, $refused->get_error_data()['status']);
        self::assertSame(['campaigns.0.display_type', 'campaigns.2.starts_at'], array_keys($refused->get_error_data()['errors']));
        self::assertSame([], $this->db->writes);
        self::assertArrayNotHasKey(PickerDocuments::OCCASIONS, $GLOBALS['wconvertTestOptionTable']);
    }

    public function testAFileThatIsNotAnOccasionIsRefused(): void
    {
        $refused = $this->occasionController()->import($this->importRequest(['format' => 'wconvert-template', 'schema' => 1]));
        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame(['format'], array_keys($refused->get_error_data()['errors']));
    }

    /** On free, the bar is refused and named; the rest import. */
    public function testAProDisplayTypeOnFreeIsRefusedForThatCampaignAlone(): void
    {
        $reply = $this->import(self::fixture(), Tier::Free);

        self::assertCount(3, $reply['created']);
        self::assertCount(1, $reply['refused']);
        self::assertSame('Black Friday top bar', $reply['refused'][0]['name']);
        self::assertSame('This display type needs WConvert Pro.', $reply['refused'][0]['reason']);
    }

    /** Every campaign refused leaves no occasion behind. */
    public function testAFileNothingOfWhichCanBeImportedChangesNothing(): void
    {
        $document = self::fixture();
        $document['campaigns'] = [$document['campaigns'][0]];

        $refused = $this->occasionController(Tier::Free)->import($this->importRequest($document));

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame(422, $refused->get_error_data()['status']);
        self::assertSame('Black Friday top bar', $refused->get_error_data()['refused'][0]['name']);
        self::assertSame([], (new OccasionStore())->ids());
        self::assertSame([], $this->db->writes);
    }

    public function testAGoalWConvertDoesNotHaveIsAnErrorInTheFile(): void
    {
        $document = self::fixture();
        $document['campaigns'][1]['goal'] = 'sell_everything';
        $document['campaigns'][2]['copy'] = ['headline' => 42];

        $refused = $this->occasionController()->import($this->importRequest($document));

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame(['campaigns.1.goal', 'campaigns.2.copy'], array_keys($refused->get_error_data()['errors']));
    }

    public function testAnUnknownDesignIsRefusedForThatCampaignAlone(): void
    {
        $document = self::fixture();
        $document['campaigns'][1]['design'] = 'a-design-this-site-lacks';

        $reply = $this->import($document);

        self::assertCount(3, $reply['created']);
        self::assertSame([['name' => 'Black Friday popup', 'reason' => 'This site does not have that design.']], $reply['refused']);
    }

    // ------------------------------------------------------------------

    /** @param list<array<string, string>> $items */
    private function occasions(array $items): void
    {
        $saved = (new OccasionStore())->write(static fn (): array => $items);
        self::assertIsArray($saved);
    }

    /** @return array<string, string> */
    private static function blackFriday(): array
    {
        return ['id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-20', 'end' => '2026-12-01'];
    }

    /** @return array<string, mixed> */
    private static function fixture(): array
    {
        return json_decode((string) file_get_contents(self::FIXTURE), true);
    }

    /**
     * @param array<string, mixed> $config
     * @return WP_Error|array<string, mixed>
     */
    private function create(array $config, string $name = 'Under test')
    {
        $request = new WP_REST_Request();
        $request->set_param('name', $name);
        $request->set_param('goal', Goal::PromoteOffer->value);
        $request->set_param('config', $config + ['template_id' => 'offer-panel', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);
        $response = $this->controller->store($request);
        return $response instanceof WP_Error ? $response : $response->get_data();
    }

    /** @return array<string, mixed> */
    private function row(string $id): array
    {
        $request = new WP_REST_Request();
        $rows = $this->controller->index($request)->get_data();
        foreach ($rows as $row) {
            if ($row['id'] === $id) return $row;
        }
        self::fail('no such row');
    }

    /** @return array<string, mixed> */
    private function show(string $id): array
    {
        $request = new WP_REST_Request();
        $request->set_param('id', $id);
        $response = $this->controller->show($request);
        self::assertInstanceOf(WP_REST_Response::class, $response);
        return $response->get_data();
    }

    private function occasionController(Tier $tier = Tier::Pro): OccasionController
    {
        return new OccasionController($this->optins, new OccasionStore(), $this->library, $this->templates, new \WConvert\Template\CampaignBuilder($this->library, $this->templates, new FakeProPresence($tier)));
    }

    /** @return array<string, mixed> */
    private function copy(string $id): array
    {
        $request = new WP_REST_Request();
        $request->set_param('id', $id);
        $response = $this->occasionController()->copy($request);
        self::assertInstanceOf(WP_REST_Response::class, $response, $response instanceof WP_Error ? $response->get_error_message() : '');
        return $response->get_data();
    }

    /** @return array<string, mixed> */
    private function export(string $id): array
    {
        $request = new WP_REST_Request();
        $request->set_param('id', $id);
        $response = $this->occasionController()->export($request);
        self::assertInstanceOf(WP_REST_Response::class, $response);
        return json_decode((string) json_encode($response->get_data()), true);
    }

    /** @param array<string, mixed> $document */
    private function importRequest(array $document): WP_REST_Request
    {
        $request = new WP_REST_Request();
        $request->set_param('document', $document);
        return $request;
    }

    /**
     * @param array<string, mixed> $document
     * @return array<string, mixed>
     */
    private function import(array $document, Tier $tier = Tier::Pro): array
    {
        $response = $this->occasionController($tier)->import($this->importRequest($document));
        self::assertInstanceOf(WP_REST_Response::class, $response, $response instanceof WP_Error ? $response->get_error_message() . ' ' . json_encode($response->get_error_data()) : '');
        return $response->get_data();
    }
}
