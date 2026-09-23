<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\WpdbConnection;
use WConvert\Lead\JourneyCapture;
use WConvert\Lead\CaptureGrant;
use WConvert\Database\Connection;
use WConvert\Database\DatabaseException;
use WConvert\Stats\StatsRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Rules\RuleVocabulary;
use WConvert\Milestone\MilestoneStore;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\CaptureController;
use WConvert\Rest\CaptureRateLimit;
use WConvert\Rest\Routes;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeTransientStore;

/**
 * The capture route's REGISTRATION, which is where two of this endpoint's
 * guarantees live and nowhere else.
 *
 * Both are invisible to every test that goes through {@see
 * \WConvert\Lead\CaptureForm}: that class would keep passing while the route
 * above it quietly changed what reaches it.
 */
#[CoversClass(CaptureController::class)]
#[CoversClass(Routes::class)]
final class CaptureControllerTest extends TestCase
{
    private static function controller(): CaptureController
    {
        $options = new FakeOptionStore();
        $db = new FakeConnection();
        $published = new PublishedSet($options);
        return new CaptureController(
            $published,
            new JourneyCapture($db, new StatsRepository($db)),
            new OptinRepository($db, $published, RuleVocabulary::fromManifest(), new MilestoneStore($options)),
            new CaptureGrant('test-signing-key'),
            TemplateVocabulary::fromManifest(__DIR__ . '/../../..'),
            new CaptureRateLimit(new FakeTransientStore())
        );
    }

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        self::controller()->registerRoutes();
    }

    protected function tearDown(): void
    {
        remove_all_actions(JourneyCapture::ACCEPTED);
    }

    /**
     * @return array{namespace: string, route: string, args: array<mixed>}
     */
    private static function captureRoute(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        self::assertCount(1, $routes, 'the controller registers exactly one route');

        return $routes[0];
    }

    /**
     * @return array<string, mixed>
     */
    private static function declaredArgs(): array
    {
        /** @var array<string, mixed> $args */
        $args = self::captureRoute()['args'][0]['args'];

        return $args;
    }

    public function testItRegistersOnePublicPostRouteInWConvertsNamespace(): void
    {
        $route = self::captureRoute();

        $this->assertSame(Routes::NAMESPACE, $route['namespace']);
        $this->assertSame('/capture', $route['route']);
        $this->assertSame('POST', $route['args'][0]['methods']);
    }

    /**
     * Public by NATURE, not by omission: the visitor filling in a popup is not
     * logged in, and a nonce baked into a page the full-page cache serves
     * byte-identically to everyone is the same nonce for every visitor for the
     * cache's lifetime (ADR 0004).
     */
    public function testTheCaptureRouteIsPublicAndSaysSo(): void
    {
        $permission = self::captureRoute()['args'][0]['permission_callback'];

        $this->assertSame([Routes::class, 'canCapture'], $permission);
        $this->assertTrue(Routes::canCapture());
    }

    /**
     * **The whole point of this file.**
     *
     * `consent` and `fields` are deliberately undeclared. WordPress runs
     * `rest_sanitize_value_from_schema` over any arg that names a `type`, and
     * for `'boolean'` that coerces `"true"`, `"on"` and `"1"` into `true` —
     * so a one-word "tidy-up" adding `'type' => 'boolean'` would leave every
     * `CaptureFormTest` green while a submission spelling consent as a string
     * asserted it. An optional consent checkbox captures Leads whose consent
     * was explicitly refused, which is worse than never asking (ADR 0032).
     */
    public function testTheRouteDeclaresNoSchemaForConsentOrTheCapturedFields(): void
    {
        $args = self::declaredArgs();

        $this->assertArrayNotHasKey('consent', $args, 'ADR 0032: consent must reach CaptureForm uncoerced');
        $this->assertArrayNotHasKey('fields', $args);
        $this->assertSame(['optin_id'], array_keys($args));
    }

    public function testAnOversizedBodyIsRefusedBeforeAnyCampaignLookupOrWrite(): void
    {
        $request = new \WP_REST_Request('POST', '/wconvert/v1/capture');
        $request->set_body(str_repeat('x', CaptureController::MAX_BODY_BYTES + 1));

        $response = self::controller()->capture($request);

        $this->assertInstanceOf(\WP_Error::class, $response);
        $this->assertSame('wconvert_capture_too_large', $response->get_error_code());
        $this->assertSame(['status' => 413], $response->get_error_data());
    }

    public function testARejectedLeadInsertReturnsASafeErrorAndDoesNotDispatchTheLead(): void
    {
        $options = new FakeOptionStore();
        $published = new PublishedSet($options);
        $optins = new OptinRepository(new FakeConnection(), $published, RuleVocabulary::fromManifest(), new MilestoneStore($options));
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-email-only.json'), true);
        $config = ['template' => $template, 'display_type' => 'popup', 'capture_mode' => 'local', 'rules' => [['type' => 'page_load']]];
        $optin = $optins->create('Capture test', 'grow_email_list', $config);
        $optins->publish($optin->id);
        $db = $this->createMock(Connection::class);
        $db->method('transaction')->willReturnCallback(static fn (callable $work) => $work());
        $db->method('row')->willReturn(['option_value' => (string) json_encode(['expires' => time() + 1800, 'lead' => null])]);
        $db->method('insert')->willThrowException(new DatabaseException('safe storage failure'));
        $dispatched = false;
        add_action(JourneyCapture::ACCEPTED, static function () use (&$dispatched): void { $dispatched = true; });
        $grants = new CaptureGrant('test-signing-key');
        $contract = \WConvert\Template\CaptureContract::fingerprint($config, $optin->goal, get_privacy_policy_url());
        $controller = new CaptureController($published, new JourneyCapture($db, new StatsRepository($db)), $optins, $grants,
            TemplateVocabulary::fromManifest(dirname(__DIR__, 3)), new CaptureRateLimit(new FakeTransientStore()));
        $request = new \WP_REST_Request('POST', '/wconvert/v1/capture');
        $request->set_param('optin_id', $optin->id);
        $request->set_body((string) json_encode(['fields' => ['email' => 'sarah@example.com'], 'consent' => true,
            'submission' => $template['tree']['submissions'][0]['id'], 'contract' => $contract, 'grant' => $grants->issue($optin->id, $contract, time())]));

        $response = $controller->capture($request);

        self::assertInstanceOf(\WP_Error::class, $response);
        self::assertSame('wconvert_capture_storage_failed', $response->get_error_code());
        self::assertSame(['status' => 500], $response->get_error_data());
        self::assertStringNotContainsString('sarah@example.com', $response->get_error_message());
        self::assertStringNotContainsString('INSERT', $response->get_error_message());
        self::assertFalse($dispatched, 'Nothing downstream may receive a Lead that was not stored.');
    }
}
