<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleManifest;
use WConvert\Targeting\TargetingType;

/**
 * The manifest and the evaluator say the same thing.
 *
 * ADR 0005 allows the evaluator switch to be the manifest's one hand-written
 * duplicate, on the condition that a test asserts parity. This is that test,
 * for the Targeting axis. The trigger and condition halves land with the
 * loader that evaluates them.
 */
#[CoversClass(RuleManifest::class)]
final class RuleManifestParityTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** @return array<string, array<string, mixed>> */
    private function targeting(): array
    {
        return RuleManifest::axis('targeting', self::PLUGIN_DIR);
    }

    public function testEveryPageRuleInTheManifestIsACaseOfTheEvaluatorsEnum(): void
    {
        $manifest = array_keys(array_filter($this->targeting(), static fn (array $e): bool => $e['kind'] === 'page'));
        $enum = array_map(static fn (TargetingType $t): string => $t->value, TargetingType::cases());

        sort($manifest);
        sort($enum);

        $this->assertSame($manifest, $enum);
    }

    /**
     * The visitor half of the axis is one predicate held as a field on
     * Targeting rather than as a member of the include/exclude lists, so it
     * cannot be checked against the enum. Pinning the set instead: a second
     * visitor rule would need a second field, and this is what says so.
     */
    public function testTheVisitorHalfOfTheAxisIsExactlyLoggedIn(): void
    {
        $visitor = array_keys(array_filter($this->targeting(), static fn (array $e): bool => $e['kind'] === 'visitor'));

        $this->assertSame(['logged_in'], $visitor);
    }

    /**
     * Four fields on every entry (ADR 0029). Targeting's last two are null,
     * which is a claim — server-evaluated, stores nothing, never degraded —
     * and not an omission, so the key must be present to make it.
     */
    public function testEveryEntryCarriesAllFourFields(): void
    {
        foreach ($this->targeting() as $type => $entry) {
            foreach (['kind', 'tier', 'consent_category', 'on_absence'] as $field) {
                $this->assertArrayHasKey($field, $entry, sprintf('targeting.%s is missing %s', $type, $field));
            }

            $this->assertContains($entry['tier'], ['free', 'pro'], sprintf('targeting.%s has no valid tier', $type));
        }
    }
}
