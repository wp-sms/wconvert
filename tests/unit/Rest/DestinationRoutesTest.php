<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\BulkRePush;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Lead\LeadRepository;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\DestinationController;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\FakeWsmsContacts;

/**
 * The [[Destination]] routes, and the guarantee that lives in the response
 * rather than in any one method.
 *
 * **A credential never leaves the server.** WordPress gives a plugin nowhere
 * safe to put an API key — a key encrypted with a key in the same database is
 * theatre, and a key in `wp-config.php` breaks on migration — so the real
 * protection is that reads hand back a mask and the value only ever travels
 * inwards (#4). That is a property of the payload, invisible to a test that
 * checks a route exists.
 */
#[CoversClass(DestinationController::class)]
final class DestinationRoutesTest extends TestCase
{
    private FakeOptionStore $options;

    private DestinationController $controller;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $this->options = new FakeOptionStore();
        $db = new FakeConnection();

        $destinations = new DestinationStore($this->options);
        $connections = new ConnectionStore($this->options);
        $health = new HealthStore($this->options);

        $registry = (new DestinationRegistry(
            new FakeProPresence(),
            new FakeSitePresence([SiteDependency::Wsms])
        ))->register(new WsmsDestinationType(new FakeWsmsContacts()));

        $optins = new OptinRepository(
            $db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($this->options)
        );

        $this->controller = new DestinationController(
            $registry,
            $destinations,
            $connections,
            $health,
            new DeliveryFailures($this->options),
            new BulkRePush($registry, $destinations, $optins, new LeadRepository($db), $health, new FakeQueue()),
            new PushDispatcher($registry, $destinations, $optins, $health, new FakeQueue(), $connections)
        );

        $this->controller->registerRoutes();
    }

    public function testItRegistersOneReadRouteAndTwoActionsUnderTheSharedNamespace(): void
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        $registered = array_map(static fn (array $route): string => $route['route'], $routes);

        self::assertContains('/destinations', $registered);
        self::assertNotSame([], array_filter($registered, static fn (string $route): bool => str_contains($route, 'repush')));

        foreach ($routes as $route) {
            self::assertSame(Routes::NAMESPACE, $route['namespace']);
        }
    }

    /**
     * **Every route is `manage_options`.** There is no public Destination
     * route and there is no shape one could take: the only public endpoints
     * WConvert has are the capture and the beacon, and both are public for
     * structural reasons rather than by omission.
     */
    public function testEveryRouteRequiresManageOptions(): void
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        foreach ($routes as $route) {
            foreach ($route['args'] as $method) {
                self::assertSame(
                    [Routes::class, 'canManage'],
                    $method['permission_callback'] ?? null,
                    'A Destination route holds credentials and health; it is administration.'
                );
            }
        }
    }

    public function testCredentialsAreReturnedMaskedAndNeverAsValues(): void
    {
        (new ConnectionStore($this->options))->save(null, 'mailchimp', 'Main account', [
            'api_key' => 'super-secret-key-abc123',
            'server' => '',
        ]);

        $payload = $this->controller->index()->get_data();

        $json = (string) json_encode($payload);

        self::assertStringNotContainsString('super-secret-key-abc123', $json);
        // The KEYS survive, so the admin can render the fields it has, and an
        // empty one still reads as empty rather than as filled.
        self::assertSame('••••••••', $payload['connections'][0]['credentials']['api_key']);
        self::assertSame('', $payload['connections'][0]['credentials']['server']);
    }

    public function testHealthTravelsBesideEachConfiguredDestination(): void
    {
        $id = (new DestinationStore($this->options))->save(null, 'wsms', 'WP SMS', null, [])->id;
        (new HealthStore($this->options))->failed($id, 'Gateway timeout', '2026-08-25 10:00:00');

        $payload = $this->controller->index()->get_data();

        self::assertSame('Gateway timeout', $payload['destinations'][0]['health']['last_error']);
        self::assertSame(1, $payload['destinations'][0]['health']['consecutive_failures']);
        self::assertSame('ready', $payload['destinations'][0]['availability']);
    }

    /**
     * ========================================================================
     * WHERE EACH ROUTE LANDS TRAVELS WITH IT, AND IT IS COMPUTED HERE.
     * ========================================================================
     * The browser could not do this. It holds `types[].settings_schema`, which
     * {@see DestinationController::connectionForType()} builds from the FIRST
     * Connection of a type — right for a type, wrong for a Destination, and
     * the second account's audience would be named with the first account's
     * id-to-label map. {@see ConfiguredTarget} is the one spelling of the rule
     * and it stays on this side of REST.
     */
    public function testWhereEachDestinationLandsTravelsBesideIt(): void
    {
        $type = new FakeDestinationType('fake');
        $type->settingsSchema = [
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists',
                'options' => [
                    ['value' => '3', 'label' => 'Newsletter'],
                    ['value' => '4', 'label' => 'Product updates'],
                ],
            ],
        ];

        $destinations = new DestinationStore($this->options);
        $destinations->save(null, 'fake', 'Newsletter signups', null, ['lists' => ['3']]);
        $destinations->save(null, 'fake', 'Product announcements', null, ['lists' => ['4']]);

        $payload = $this->controllerFor($type)->index()->get_data();

        // **Two routes of one type, each named for what IT points at.** This
        // is the move the Add button used to forbid and the model requires.
        $targets = array_column($payload['destinations'], 'target', 'label');

        self::assertSame(
            ['Newsletter signups' => 'Newsletter', 'Product announcements' => 'Product updates'],
            $targets
        );
    }

    /**
     * **A type that selects nothing says nothing**, and it is not the same
     * answer as a type that selects something nobody has chosen.
     *
     * The lead-magnet email is the live case: its URL, subject and body are
     * configuration, so it is perfectly configured — and a screen printing
     * *"not pointed at anything yet"* under it would report a fault against an
     * integration that delivers.
     */
    public function testATypeThatSelectsNothingReportsNullAndAnUnpointedOneReportsEmpty(): void
    {
        $type = new FakeDestinationType('fake');
        $type->settingsSchema = ['subject' => ['type' => 'text', 'label' => 'Subject line']];

        $destinations = new DestinationStore($this->options);
        $destinations->save(null, 'fake', 'The guide', null, ['subject' => 'Your download']);

        self::assertNull($this->controllerFor($type)->index()->get_data()['destinations'][0]['target']);

        $type->settingsSchema = [
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists',
                'options' => [['value' => '3', 'label' => 'Newsletter']],
            ],
        ];

        self::assertSame('', $this->controllerFor($type)->index()->get_data()['destinations'][0]['target']);
    }

    /**
     * **A provider having a bad time is silence, never a guess and never a
     * 500.**
     *
     * A schema read can reach the wire, so an unreachable ESP means we could
     * not LOOK — a different thing from looking and finding nothing chosen.
     * Reporting `''` there would put "not pointed at anything yet" under every
     * Destination on the screen whose whole job is to say whether things are
     * working (ADR 0042).
     */
    public function testAnUnreachableProviderReportsNoTargetRatherThanFailing(): void
    {
        $type = new FakeDestinationType('fake');
        $type->schemaFailure = new \RuntimeException('The provider is down.');

        (new DestinationStore($this->options))
            ->save(null, 'fake', 'Newsletter signups', null, ['lists' => ['3']]);

        // Through `store()`, because `index()` reads the type's own schema
        // first and has always let that surface — the guard under test is the
        // one around the per-Destination read.
        $request = new \WP_REST_Request('POST');
        $request->set_param('type', 'fake');
        $request->set_param('label', 'Product announcements');

        /** @var \WP_REST_Response $response */
        $response = $this->controllerFor($type)->store($request);
        $payload = $response->get_data();

        self::assertNull($payload['destinations'][0]['target']);
        self::assertNull($payload['destinations'][1]['target']);
    }

    /**
     * ========================================================================
     * TWO ROUTES OVER ONE CONNECTION READ ONE SCHEMA.
     * ========================================================================
     * A schema read is how a Mailchimp audience gets a NAME, and it goes over
     * the wire. Without the memo a merchant with five Mailchimp routes pays
     * six round trips to that provider on every load of the Destinations
     * screen and every load of the builder, for six identical answers.
     *
     * Keyed by the Connection, because the Connection is what changes the
     * answer: two ACCOUNTS are two keys and two id-to-label maps that
     * disagree.
     */
    public function testTwoRoutesOverOneConnectionReadTheSchemaOnce(): void
    {
        $type = new FakeDestinationType('fake');
        $type->connectionSchema = ['api_key' => ['type' => 'text', 'label' => 'API key']];
        $type->settingsSchema = [
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists',
                'options' => [['value' => '3', 'label' => 'Newsletter']],
            ],
        ];

        $connection = (new ConnectionStore($this->options))
            ->save(null, 'fake', 'Main account', ['api_key' => 'k']);

        $destinations = new DestinationStore($this->options);
        $destinations->save(null, 'fake', 'Newsletter signups', $connection->id, ['lists' => ['3']]);
        $destinations->save(null, 'fake', 'Product announcements', $connection->id, ['lists' => ['3']]);
        $destinations->save(null, 'fake', 'A third', $connection->id, ['lists' => ['3']]);

        $this->controllerFor($type)->index();

        // ONE. The types list and all three Destinations share the account,
        // so they share the answer.
        self::assertSame(1, $type->schemaReads);
    }

    /**
     * **Two ACCOUNTS are two reads**, because the first account's id-to-label
     * map names the wrong audience — which is the failure
     * `DestinationController::targetOf()`'s docblock refuses.
     */
    public function testTwoAccountsAreTwoReadsBecauseTheirNamesDisagree(): void
    {
        $type = new FakeDestinationType('fake');
        $type->connectionSchema = ['api_key' => ['type' => 'text', 'label' => 'API key']];

        $connections = new ConnectionStore($this->options);
        $first = $connections->save(null, 'fake', 'Main account', ['api_key' => 'one']);
        $second = $connections->save(null, 'fake', 'The other one', ['api_key' => 'two']);

        $destinations = new DestinationStore($this->options);
        $destinations->save(null, 'fake', 'Newsletter signups', $first->id, []);
        $destinations->save(null, 'fake', 'Product announcements', $second->id, []);

        $this->controllerFor($type)->index();

        self::assertSame(2, $type->schemaReads);
        self::assertSame(
            [['api_key' => 'one'], ['api_key' => 'two']],
            $type->schemaCredentials,
            'Each account was asked with its own key.'
        );
    }

    /**
     * **A route with no name still has to be findable.**
     *
     * The name is what tells two Destinations of one type apart on the tab
     * where an [[Optin]] is bound, so an empty one would render a checkbox
     * with no words beside it. Whitespace is the same accident and gets the
     * same answer.
     */
    public function testAnEmptyNameFallsBackToTheTypesOwnLabel(): void
    {
        $type = new FakeDestinationType('fake');

        foreach (['', '   '] as $given) {
            $options = new FakeOptionStore();
            $request = new \WP_REST_Request('POST');
            $request->set_param('type', 'fake');
            $request->set_param('label', $given);

            /** @var \WP_REST_Response $response */
            $response = $this->controllerFor($type, $options)->store($request);

            self::assertSame('Fake', $response->get_data()['destinations'][0]['label']);
        }
    }

    /** A name the merchant gave is kept, trimmed of what a paste brings with it. */
    public function testAGivenNameIsKept(): void
    {
        $type = new FakeDestinationType('fake');

        $request = new \WP_REST_Request('POST');
        $request->set_param('type', 'fake');
        $request->set_param('label', '  Black Friday signups ');

        /** @var \WP_REST_Response $response */
        $response = $this->controllerFor($type)->store($request);

        self::assertSame('Black Friday signups', $response->get_data()['destinations'][0]['label']);
    }

    /**
     * A controller over one registered type, sharing this test's option store
     * unless another is given.
     *
     * {@see FakeDestinationType} is what makes the schema staged and counted —
     * `WsmsDestinationType` declares one field it cannot enumerate, which is
     * the right subject for one of these cases and none of the others.
     */
    private function controllerFor(
        FakeDestinationType $type,
        ?FakeOptionStore $options = null
    ): DestinationController {
        $options ??= $this->options;
        $db = new FakeConnection();

        $destinations = new DestinationStore($options);
        $connections = new ConnectionStore($options);
        $health = new HealthStore($options);

        $registry = (new DestinationRegistry(
            new FakeProPresence(),
            new FakeSitePresence([SiteDependency::Wsms])
        ))->register($type);

        $optins = new OptinRepository(
            $db,
            new PublishedSet($options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($options)
        );

        return new DestinationController(
            $registry,
            $destinations,
            $connections,
            $health,
            new DeliveryFailures($options),
            new BulkRePush($registry, $destinations, $optins, new LeadRepository($db), $health, new FakeQueue()),
            new PushDispatcher($registry, $destinations, $optins, $health, new FakeQueue(), $connections)
        );
    }
}
