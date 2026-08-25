<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\CaptureController;
use WConvert\Rest\Routes;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Optin\FakeConnection;
use WConvert\Tests\Unit\Optin\FakeOptionStore;

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
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $controller = new CaptureController(
            new PublishedSet(new FakeOptionStore()),
            new LeadCapture(new LeadRepository(new FakeConnection())),
            TemplateVocabulary::fromManifest(__DIR__ . '/../../..')
        );

        $controller->registerRoutes();
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
}
