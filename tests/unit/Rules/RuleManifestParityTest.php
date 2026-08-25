<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleKind;
use WConvert\Rules\RuleManifest;
use WConvert\Targeting\TargetingType;

/**
 * The manifest and the evaluator say the same thing — PHP's half.
 *
 * ADR 0005 allows the evaluator switch to be the manifest's one hand-written
 * duplicate, on the condition that a test asserts parity. PHP only evaluates
 * one of the three axes, so this file asserts:
 *
 * - **parity for Targeting**, against the enum that is its switch, and
 * - **the four-field invariant across every axis**, because PHP is what reads
 *   `tier`, `consent_category` and `on_absence` — the loader never sees a rule
 *   its install is not entitled to.
 *
 * The trigger/condition half of parity — every entry resolving to a module on
 * the side its `tier` names — is asserted in TypeScript, where the modules
 * are: `tests/js/manifest-parity.test.ts` and `pro/tests/js/manifest-parity.test.ts`.
 */
#[CoversClass(RuleManifest::class)]
final class RuleManifestParityTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** The axes the manifest is allowed to declare, and the kinds each may hold. */
    private const AXES = [
        'targeting' => [RuleKind::Page, RuleKind::Visitor],
        'triggers' => [RuleKind::Trigger],
        'conditions' => [RuleKind::Condition],
    ];

    /** WP Consent API's five categories, adopted verbatim (CONTEXT.md, Storage Consent). */
    private const CONSENT_CATEGORIES = ['functional', 'statistics-anonymous', 'statistics', 'preferences', 'marketing'];

    /** @return array<string, array<string, mixed>> */
    private function axis(string $axis): array
    {
        return RuleManifest::axis($axis, self::PLUGIN_DIR);
    }

    /** @return iterable<string, array{string, list<RuleKind>}> */
    public static function axes(): iterable
    {
        foreach (self::AXES as $axis => $kinds) {
            yield $axis => [$axis, $kinds];
        }
    }

    public function testTheManifestDeclaresEveryAxisAndNoOthers(): void
    {
        $this->assertSame(array_keys(self::AXES), array_keys(RuleManifest::load(self::PLUGIN_DIR)));
    }

    public function testEveryPageRuleInTheManifestIsACaseOfTheEvaluatorsEnum(): void
    {
        $manifest = array_keys(array_filter($this->axis('targeting'), static fn (array $e): bool => $e['kind'] === 'page'));
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
        $visitor = array_keys(array_filter($this->axis('targeting'), static fn (array $e): bool => $e['kind'] === 'visitor'));

        $this->assertSame(['logged_in'], $visitor);
    }

    /**
     * Four fields on every entry (ADR 0029) — `tier`, `consent_category`,
     * `on_absence` and kind. The key must be PRESENT even where the value is
     * null, because null is a claim: Targeting is server-evaluated, writes
     * nothing to the visitor's device, and is never degraded away.
     *
     * @param list<RuleKind> $kinds
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('axes')]
    public function testEveryEntryCarriesAllFourFields(string $axis, array $kinds): void
    {
        $entries = $this->axis($axis);

        $this->assertNotSame([], $entries, sprintf('%s declares no rule types', $axis));

        foreach ($entries as $type => $entry) {
            $where = sprintf('%s.%s', $axis, $type);

            foreach (['kind', 'tier', 'consent_category', 'on_absence'] as $field) {
                $this->assertArrayHasKey($field, $entry, sprintf('%s is missing %s', $where, $field));
            }

            $this->assertContains($entry['tier'], ['free', 'pro'], sprintf('%s has no valid tier', $where));

            $this->assertContains(
                RuleKind::tryFrom((string) $entry['kind']),
                $kinds,
                sprintf('%s declares a kind this axis does not hold', $where)
            );

            $this->assertContains(
                $entry['consent_category'],
                [null, ...self::CONSENT_CATEGORIES],
                sprintf('%s declares a consent category the WP Consent API does not have', $where)
            );
        }
    }

    /**
     * `on_absence` is a closed pair — `drop | suspend`, defaulting to `drop`
     * (ADR 0027), and null only where absence cannot arise. Targeting is
     * evaluated on the server and never degraded away; a client rule always
     * names one, because Pro or WooCommerce can stop being installed at any
     * moment and config outlives the code that reads it.
     */
    public function testOnlyTheServerAxisMayDeclineToAnswerOnAbsence(): void
    {
        foreach (self::AXES as $axis => $_kinds) {
            $allowed = $axis === 'targeting' ? [null] : ['drop', 'suspend'];

            foreach ($this->axis($axis) as $type => $entry) {
                $this->assertContains(
                    $entry['on_absence'],
                    $allowed,
                    sprintf('%s.%s declares an on_absence this axis may not', $axis, $type)
                );
            }
        }
    }

    /**
     * The readme's earned claim, asserted rather than asserted-about: "a free
     * WConvert install stores nothing that requires consent" (issue #11). It
     * holds today because no free rule stores anything at all; the moment one
     * does, this is what makes the claim a decision rather than an accident.
     */
    public function testNoFreeRuleStoresAnythingNeedingConsent(): void
    {
        foreach (self::AXES as $axis => $_kinds) {
            foreach ($this->axis($axis) as $type => $entry) {
                if ($entry['tier'] !== 'free') {
                    continue;
                }

                $this->assertContains(
                    $entry['consent_category'],
                    [null, 'functional'],
                    sprintf('free rule %s.%s needs consent the free tier claims not to need', $axis, $type)
                );
            }
        }
    }
}
