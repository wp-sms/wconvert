<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rest\RuleController;
use WConvert\Rest\Routes;
use WConvert\Rest\ThemeController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeProPresence;

/**
 * The builder's two reads, and the fact that they ARE reads.
 *
 * Same division the other REST tests draw: what these controllers do is
 * {@see RuleCatalogue} and {@see \WConvert\Template\ThemeTokens}, each with
 * its own tests; what they are is only visible here.
 *
 * **Both are `GET`, and theme inheritance being one is the point.** It is an
 * opt-in VALUE COPY: the panel reads the site's palette when a merchant asks
 * for it and copies the values into the Optin's own tokens. Registered as
 * anything else it would read as a setting being stored, which is precisely
 * the live link ADR 0010 keeps a snapshot away from — a stored "inherit"
 * would restyle every running Optin the day the merchant switches theme.
 */
#[CoversClass(RuleController::class)]
#[CoversClass(ThemeController::class)]
final class BuilderRoutesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        (new RuleController(new RuleCatalogue(
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new FakeProPresence()
        )))->registerRoutes();

        (new ThemeController())->registerRoutes();
    }

    /**
     * @return list<array{namespace: string, route: string, args: array<mixed>}>
     */
    private static function routes(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        return $routes;
    }

    public function testBothAreReadsUnderOneNamespaceAndOneCapability(): void
    {
        $this->assertSame(['/rules', '/theme'], array_column(self::routes(), 'route'));

        foreach (self::routes() as $registered) {
            $this->assertSame(Routes::NAMESPACE, $registered['namespace']);
            $this->assertCount(1, $registered['args'], $registered['route'] . ' registers more than one handler');
            $this->assertSame('GET', $registered['args'][0]['methods'], $registered['route'] . ' is not a read');
            $this->assertSame([Routes::class, 'canManage'], $registered['args'][0]['permission_callback']);
        }
    }
}
