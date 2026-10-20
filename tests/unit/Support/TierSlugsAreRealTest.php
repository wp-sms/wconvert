<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Support\Tier;

/**
 * =============================================================================
 * EVERY `tier` IN THE SHIPPED DATA IS A {@see Tier} CASE.
 * =============================================================================
 * Four readers turn an unknown tier slug into {@see Tier::Free} —
 * `RuleVocabulary`, `SetupIndex`, `TemplateController` and `TemplateLibrary`
 * all read `Tier::tryFrom(...) ?? Tier::Free`. So a slug the enum does not
 * carry is not an error anywhere at runtime: it is a premium rule or design
 * silently becoming a free one. That is exactly what collapsing the ladder to
 * one tier (ADR 0146) would have done to every `basic` and `elite` value left
 * behind, and it is what this fails on.
 *
 * Walked recursively for any key named `tier`, so a file whose shape changes
 * is still read, and a new nesting cannot hide a value.
 */
#[CoversNothing]
final class TierSlugsAreRealTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private const SOURCES = [
        'resources/rules/manifest.json',
        'resources/templates/library/*.json',
        'pro/modules/*/templates/*.json',
        'tools/integration-preview/fixtures/*.json',
    ];

    /** @return iterable<string, array{string}> */
    public static function files(): iterable
    {
        foreach (self::SOURCES as $pattern) {
            foreach (glob(self::PLUGIN_DIR . '/' . $pattern) ?: [] as $file) {
                yield substr($file, strlen(self::PLUGIN_DIR) + 1) => [$file];
            }
        }
    }

    public function testEverySourceIsThere(): void
    {
        foreach (self::SOURCES as $pattern) {
            $this->assertNotSame([], glob(self::PLUGIN_DIR . '/' . $pattern) ?: [], $pattern . ' matched nothing — the check below read nothing there');
        }
    }

    #[DataProvider('files')]
    public function testEveryTierInTheFileIsATierCase(string $file): void
    {
        $decoded = json_decode((string) file_get_contents($file), true);

        $this->assertIsArray($decoded, $file . ' is not JSON');

        foreach (self::tiers($decoded) as $path => $tier) {
            $this->assertNotNull(Tier::tryFrom($tier), sprintf('%s at %s is "%s", which is not a Tier — it would read as free', basename($file), $path, $tier));
        }
    }

    /**
     * @param array<mixed> $node
     * @return iterable<string, string>
     */
    private static function tiers(array $node, string $path = ''): iterable
    {
        foreach ($node as $key => $value) {
            $here = $path === '' ? (string) $key : $path . '.' . $key;

            if ($key === 'tier' && is_string($value)) {
                yield $here => $value;
            } elseif (is_array($value)) {
                yield from self::tiers($value, $here);
            }
        }
    }
}
