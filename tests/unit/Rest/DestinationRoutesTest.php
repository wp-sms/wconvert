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
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\DestinationController;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Tests\Unit\Support\FakeConnection;
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
            new FakeProPresence(false),
            new FakeSitePresence([SiteDependency::Wsms])
        ))->register(new WsmsDestinationType(new FakeWsmsContacts()));

        $optins = new OptinRepository(
            $db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3))
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
}
