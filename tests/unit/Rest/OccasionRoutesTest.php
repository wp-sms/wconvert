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
#[CoversClass(OptinController::class)]
#[CoversClass(OccasionStore::class)]
final class OccasionRoutesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private OptinRepository $optins;
    private OptinController $controller;
    private TemplateVocabulary $templates;
    private TemplateLibrary $library;
    private FakeConnection $db;

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
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wpdb']);
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
}
