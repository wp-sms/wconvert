<?php
namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Rest\{ProductHealthController, Routes};
use WConvert\Optin\{OptinRepository, PublishedSet};
use WConvert\Milestone\MilestoneStore;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\{FakeConnection, FakeOptionStore, Journeys};

final class ProductHealthControllerTest extends TestCase
{
    private const ID = '01JQ00000000000000000000AA';
    private FakeConnection $db;
    private ProductHealthController $controller;

    protected function setUp(): void
    {
        Journeys::on();
        $this->db = new FakeConnection();
        $options = new FakeOptionStore();
        $this->controller = new ProductHealthController(new OptinRepository($this->db, new PublishedSet($options), RuleVocabulary::fromManifest(dirname(__DIR__, 3)), new MilestoneStore($options)));
        $draft = ['template' => ['tree' => ['steps' => [['results' => [['heading' => 'Draft picks', 'product_ids' => [1]]]]]]]];
        $published = ['template' => ['tree' => ['steps' => [['results' => [['heading' => 'Live picks', 'product_ids' => [2]]]]]]]];
        $this->db->rows[self::ID] = ['id' => self::ID, 'name' => 'Quiz', 'goal' => 'find_match', 'config' => json_encode($draft, JSON_THROW_ON_ERROR), 'published_config' => json_encode($published, JSON_THROW_ON_ERROR), 'published_at' => '2026-10-05 10:00:00', 'deleted_at' => null, 'parent_id' => null];
    }

    protected function tearDown(): void { Journeys::off(); }

    /** @param list<string> $ids */
    private function read(array $ids): \WP_REST_Response|\WP_Error
    {
        $request = new \WP_REST_Request('GET'); $request->set_param('ids', $ids);
        return $this->controller->read($request);
    }

    public function testLiveVersionCannotBeHiddenByAnUnpublishedRepairAndReadsDoNotWrite(): void
    {
        $response = $this->read([self::ID]);
        self::assertInstanceOf(\WP_REST_Response::class, $response);
        self::assertSame('published', $response->get_data()[0]['basis']);
        self::assertSame('Live picks', $response->get_data()[0]['checks'][0]['label']);
        // WooCommerce is absent in this unit environment: never report healthy.
        self::assertSame('unknown', $response->get_data()[0]['checks'][0]['state']);
        $this->db->rows[self::ID]['published_at'] = null;
        $draft = $this->read([self::ID]);
        self::assertInstanceOf(\WP_REST_Response::class, $draft);
        self::assertSame('Draft picks', $draft->get_data()[0]['checks'][0]['label']);
        self::assertSame([], $this->db->writes);
    }

    public function testDeletedCampaignsAreNotInspectedAndInvalidBatchesDoNotRead(): void
    {
        foreach ([[], array_fill(0, 13, self::ID), ['invalid']] as $ids) self::assertInstanceOf(\WP_Error::class, $this->read($ids));
        self::assertSame([], $this->db->reads);
        $this->db->rows[self::ID]['deleted_at'] = '2026-10-05 10:30:00';
        $deleted = $this->read([self::ID]);
        self::assertInstanceOf(\WP_REST_Response::class, $deleted);
        self::assertSame('Campaign unavailable. Refresh the campaign list.', $deleted->get_data()[0]['checks'][0]['message']);
    }

    public function testAnInstallThatCannotHoldProductsIsNeverCheckedOrToldAboutThem(): void
    {
        Journeys::off();
        $response = $this->read([self::ID]);
        self::assertInstanceOf(\WP_REST_Response::class, $response);
        self::assertSame([['id' => self::ID, 'basis' => 'draft', 'checks' => []]], $response->get_data());
        self::assertSame([], $this->db->reads);
    }

    public function testRouteRequiresAdminCapability(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $this->controller->registerRoutes();
        $route = $GLOBALS['wconvertTestRoutes'][0];
        self::assertSame([Routes::class, 'canManage'], $route['args']['permission_callback']);
        self::assertSame(12, $route['args']['args']['ids']['maxItems']);
    }

    public function testLinkOnlyFallbackIsIntentionalEvenWhenOtherResultsRequireProducts(): void
    {
        $config = ['template' => ['tree' => ['steps' => [['products_required' => true, 'results' => [
            ['heading' => 'Matching result', 'product_ids' => []],
            ['heading' => 'Everyone else', 'product_ids' => [], 'href' => '/shop'],
        ]]]]]];
        $checks = (new \WConvert\Template\ProductHealth())->inspect($config);
        self::assertSame(['Matching result'], array_column($checks, 'label'));
    }
}
