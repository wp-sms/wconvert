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
 * - **the five-field invariant across every axis**, because PHP is what reads
 *   `tier`, `consent_category`, `on_absence` and `substitute` — the loader
 *   never sees a rule its install is not entitled to, and never sees a rule
 *   that stood in for one.
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
     * Five fields on every entry (ADR 0029) — `tier`, `consent_category`,
     * `on_absence`, `substitute` and kind. The key must be PRESENT even where
     * the value is null, because null is a claim: Targeting is
     * server-evaluated, writes nothing to the visitor's device, and is never
     * degraded away, so it declares nothing to stand in for it either.
     *
     * @param list<RuleKind> $kinds
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('axes')]
    public function testEveryEntryCarriesAllFiveFields(string $axis, array $kinds): void
    {
        $entries = $this->axis($axis);

        $this->assertNotSame([], $entries, sprintf('%s declares no rule types', $axis));

        foreach ($entries as $type => $entry) {
            $where = sprintf('%s.%s', $axis, $type);

            foreach (['kind', 'tier', 'params', 'presets', 'consent_category', 'on_absence', 'substitute'] as $field) {
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
     * Every param declares the control it takes, and nothing declares a param
     * twice.
     *
     * The keys a rule's scalar arrives under are the manifest's answer now
     * rather than the loader module's private knowledge, because the builder
     * is the screen that fills them in. When they were implicit, three of the
     * four bundled [[Playbook]]s wrote `value` where the module read `seconds`
     * — a Trigger that could never fire, prefilled onto every Optin they
     * started, with nothing in any log.
     */
    /** @param list<RuleKind> $_kinds */
    #[\PHPUnit\Framework\Attributes\DataProvider('axes')]
    public function testEveryParamDeclaresItsControl(string $axis, array $_kinds): void
    {
        foreach ($this->axis($axis) as $type => $entry) {
            $this->assertIsArray($entry['params'], sprintf('%s.%s declares no params object', $axis, $type));

            foreach ($entry['params'] as $name => $param) {
                $where = sprintf('%s.%s.%s', $axis, $type, $name);

                $this->assertIsArray($param, sprintf('%s is not a declaration', $where));
                $this->assertArrayHasKey('control', $param, sprintf('%s declares no control', $where));
                $this->assertIsString($param['control'], sprintf('%s declares no control', $where));

                if (array_key_exists('authored', $param)) {
                    $this->assertIsBool($param['authored'], sprintf('%s declares a non-boolean authored', $where));
                }
            }
        }
    }

    /**
     * **A Targeting rule is `{type, value}` and nothing else.**
     *
     * {@see \WConvert\Targeting\TargetingRule} reads exactly those two keys,
     * so a targeting entry declaring a second param — or naming its one param
     * anything but `value` — declares a rule the evaluator would silently drop
     * for want of a scalar. The client axes have a free-form param bag and
     * this is what says the server axis does not.
     */
    public function testEveryTargetingRuleTakesOneParamCalledValue(): void
    {
        foreach ($this->axis('targeting') as $type => $entry) {
            $this->assertSame(
                ['value'],
                array_keys($entry['params']),
                sprintf('targeting.%s does not take exactly one param called value', $type)
            );
        }
    }

    /**
     * **A preset fixes params of the type it is declared under, and cannot
     * name a second one.**
     *
     * "One engine type, many UI presets" (ADR 0005) is structural here rather
     * than checked: a preset is declared INSIDE an entry, so it has no field
     * to name a type with. What is left to check is that the params it fixes
     * exist — a preset fixing a key nothing reads is a shortcut to a rule that
     * never holds, which is the same failure the param declaration above
     * exists to end.
     */
    /** @param list<RuleKind> $_kinds */
    #[\PHPUnit\Framework\Attributes\DataProvider('axes')]
    public function testEveryPresetFixesParamsItsTypeDeclares(string $axis, array $_kinds): void
    {
        foreach ($this->axis($axis) as $type => $entry) {
            $this->assertIsArray($entry['presets'], sprintf('%s.%s declares no presets object', $axis, $type));

            foreach ($entry['presets'] as $id => $fixed) {
                $where = sprintf('%s.%s preset %s', $axis, $type, $id);

                $this->assertIsArray($fixed, sprintf('%s fixes nothing', $where));
                $this->assertSame(
                    [],
                    array_diff(array_keys($fixed), array_keys($entry['params'])),
                    sprintf('%s fixes a param its type does not declare', $where)
                );
            }
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
     * ========================================================================
     * A SUBSTITUTE THAT COULD NOT RUN IS NOT A SUBSTITUTE.
     * ========================================================================
     * ADR 0012 substitutes a premium [[Trigger]] because a *dropped* one
     * leaves an Optin that can never fire. A substitution that names a type
     * this install also lacks, or that leaves the type's params empty, buys
     * exactly nothing: `time_on_page` reads `rule.seconds` and
     * `Number(undefined)` is NaN, so the comparison is false forever — the
     * same silent, total loss of function, one indirection further along.
     *
     * Four claims, and each one is a way the table could be written wrong:
     *
     * - it names a type the manifest declares, at tier **free**, so every
     *   install can run it;
     * - of the **same kind**, since a Trigger swapped for a Condition leaves
     *   the Optin trigger-less anyway;
     * - filling **every param that type declares** except the `authored` ones,
     *   which name something only one site has and which a manifest can no
     *   more supply than a [[Playbook]] can;
     * - and naming **no param the type does not declare**, which
     *   {@see \WConvert\Rules\RuleVocabulary::normalize()} would drop on the
     *   way into `config`.
     */
    public function testEverySubstituteNamesAFreeRuleOfTheSameKindWithItsParamsFilled(): void
    {
        $manifest = RuleManifest::load(self::PLUGIN_DIR);
        $entries = array_merge(...array_values($manifest));
        $checked = 0;

        foreach ($entries as $type => $entry) {
            $substitute = $entry['substitute'] ?? null;

            if ($substitute === null) {
                continue;
            }

            $checked++;
            $where = sprintf('%s\'s substitute', $type);

            $this->assertIsArray($substitute, sprintf('%s is not a rule', $where));
            $this->assertIsString($substitute['type'] ?? null, sprintf('%s names no type', $where));

            $named = $entries[$substitute['type']] ?? null;

            $this->assertIsArray($named, sprintf('%s names a type the manifest does not declare', $where));
            $this->assertSame('free', $named['tier'], sprintf('%s names a type this install may also lack', $where));
            $this->assertSame($entry['kind'], $named['kind'], sprintf('%s is not the same kind of rule', $where));

            $wanted = array_keys(array_filter(
                $named['params'],
                static fn (array $param): bool => ($param['authored'] ?? false) !== true
            ));

            $this->assertSame(
                $wanted,
                array_keys(array_diff_key($substitute, ['type' => true])),
                sprintf('%s does not fill exactly the params its type declares', $where)
            );
        }

        // Not a tautology: the table emptying out would make every assertion
        // above vacuous, and ADR 0012 requires the two premium Triggers that
        // have an honest stand-in to have one.
        $this->assertGreaterThan(0, $checked, 'the substitution table is empty');
    }

    /**
     * **A [[Condition]] is dropped, never substituted** (ADR 0012). There is
     * no honest substitute for "the referrer is Google", and inventing one
     * fabricates targeting the merchant never asked for and silently narrows
     * or redirects their audience — where dropping only widens it, which is
     * the safe direction to fail in.
     *
     * Targeting declares none either, and for a different reason: it is
     * evaluated on the server by code both installs carry, so it is never
     * absent and has nothing to stand in for.
     */
    public function testOnlyATriggerMayDeclareASubstitute(): void
    {
        foreach (self::AXES as $axis => $_kinds) {
            foreach ($this->axis($axis) as $type => $entry) {
                if (RuleKind::tryFrom((string) $entry['kind']) !== RuleKind::Trigger) {
                    $this->assertNull(
                        $entry['substitute'],
                        sprintf('%s.%s declares a substitute, and only a Trigger may', $axis, $type)
                    );
                }
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
