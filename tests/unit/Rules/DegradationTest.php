<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleKind;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * Losing [[Pro]] degrades rather than stops, and where degrading would make an
 * [[Optin]] lie it suspends instead.
 *
 * ADR 0012 is the rule — substitute [[Trigger]]s, drop [[Condition]]s — and
 * ADR 0027 is the marked exception. Both are read off the one rule manifest,
 * and this is the thin resolver that reads them.
 */
#[CoversClass(Degradation::class)]
#[CoversClass(SuppliedRules::class)]
final class DegradationTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** The shipped manifest, so these assertions are about what actually ships. */
    private static function shipped(): RuleVocabulary
    {
        return RuleVocabulary::fromManifest(self::PLUGIN_DIR);
    }


    // ========================================================================
    // A PREMIUM TRIGGER IS SUBSTITUTED.
    // ========================================================================

    /** @return iterable<string, array{string, string}> */
    public static function substitutions(): iterable
    {
        yield 'exit_intent' => ['exit_intent', 'time_on_page'];
        yield 'scroll_up' => ['scroll_up', 'scroll_depth'];
    }

    #[DataProvider('substitutions')]
    public function testAPremiumTriggerIsSubstitutedForTheOneTheManifestNames(string $premium, string $free): void
    {
        $resolved = InstalledRules::free()->intoConfig([['type' => $premium]]);

        $this->assertSame([$free], array_column($resolved, 'type'));
    }

    /**
     * ========================================================================
     * A SUBSTITUTE ARRIVES WITH ITS PARAMS FILLED, OR IT IS NOT A SUBSTITUTE.
     * ========================================================================
     * `time_on_page` reads `rule.seconds` and `Number(undefined)` is NaN, so a
     * substitution naming only the type swaps one silent, total loss of
     * function for another — the exact failure three of the four bundled
     * [[Playbook]]s shipped before #29 declared the params.
     */
    #[DataProvider('substitutions')]
    public function testTheSubstituteCouldActuallyFire(string $premium, string $_free): void
    {
        $vocabulary = self::shipped();

        $this->assertTrue($vocabulary->hasTrigger(InstalledRules::free($vocabulary)->intoConfig([['type' => $premium]])));
    }

    /**
     * The marker is written at PREFILL, beside the substituted rule, because
     * prefill is the call site that writes `config` at all (ADR 0012).
     */
    public function testPrefillRecordsWhatTheRuleStandsInFor(): void
    {
        $resolved = InstalledRules::free()->intoConfig([['type' => 'exit_intent']]);

        $this->assertSame('exit_intent', $resolved[0]['degraded_from'] ?? null);
    }

    // ========================================================================
    // A PREMIUM CONDITION IS DROPPED, NEVER SUBSTITUTED.
    // ========================================================================

    public function testAPremiumConditionIsDropped(): void
    {
        $resolved = InstalledRules::free()
            ->intoConfig([['type' => 'page_load'], ['type' => 'query_param', 'key' => 'utm_source']]);

        $this->assertSame([['type' => 'page_load']], $resolved);
    }

    /**
     * There is no honest substitute for "the referrer is Google", and
     * inventing one fabricates targeting nobody asked for. Asserted over the
     * manifest rather than over one entry, so a Condition that gains a
     * substitute fails here rather than shipping one.
     */
    public function testNoConditionInTheManifestDeclaresASubstitute(): void
    {
        $vocabulary = self::shipped();

        foreach ([...$vocabulary->typesAt(Tier::Free), ...$vocabulary->typesAt(Tier::Pro)] as $type) {
            if ($vocabulary->kindOf($type) === RuleKind::Condition) {
                $this->assertNull($vocabulary->substituteFor($type), sprintf('%s declares a substitute', $type));
            }
        }
    }

    // ========================================================================
    // AND AN OPTIN NEVER ENDS UP WITH ZERO TRIGGERS.
    // ========================================================================

    /**
     * `click_element` has no honest substitute — its selector names something
     * only one site has — so dropping it is right, and dropping the LAST
     * Trigger is not. An Optin that can never fire is a silent, total loss of
     * function with nothing in any log; [[Suspended]] is the same outcome with
     * a cause the merchant can read, and it heals itself when Pro returns.
     */
    public function testAnOptinWhoseLastTriggerCannotBeSubstitutedIsSuspendedRatherThanLeftInert(): void
    {
        $free = InstalledRules::free();

        $this->assertSame('click_element', $free->suspendedBy([['type' => 'click_element', 'selector' => '#buy']]));
        $this->assertNull($free->intoPayload(['id' => '01A', 'triggers' => [['type' => 'click_element', 'selector' => '#buy']]]));
    }

    /** With another Trigger beside it, dropping it only loses that one way in. */
    public function testDroppingATriggerIsFineWhileAnotherOneSurvives(): void
    {
        $free = InstalledRules::free();
        $rules = [['type' => 'click_element', 'selector' => '#buy'], ['type' => 'page_load']];

        $this->assertNull($free->suspendedBy($rules));
        $this->assertSame([['type' => 'page_load']], $free->intoConfig($rules));
    }

    /**
     * The post-condition, stated over every premium Trigger the manifest
     * declares rather than over the two that happen to have substitutes:
     * **degradation never turns an Optin that could fire into one that
     * cannot.** A premium Trigger added without a substitute fails here.
     *
     * @return iterable<string, array{string}>
     */
    public static function premiumTriggers(): iterable
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        foreach ($vocabulary->typesAt(Tier::Pro) as $type) {
            if ($vocabulary->kindOf($type) === RuleKind::Trigger) {
                yield $type => [$type];
            }
        }
    }

    #[DataProvider('premiumTriggers')]
    public function testAnOptinIsNeverDegradedIntoOneWithNoTrigger(string $premium): void
    {
        $vocabulary = self::shipped();
        $free = InstalledRules::free($vocabulary);

        // Whatever the merchant authored with Pro, on the only Trigger they had.
        $rules = [['type' => $premium, 'selector' => '#buy']];

        $this->assertTrue(
            $free->suspendedBy($rules) !== null || $vocabulary->hasTrigger($free->intoConfig($rules)),
            sprintf('%s degrades into an Optin that can never fire, and says nothing', $premium)
        );
    }

    // ========================================================================
    // `on_absence: suspend` IS THE MARKED EXCEPTION.
    // ========================================================================

    /**
     * Nothing in the shipped manifest declares `suspend` yet — the two cart
     * Conditions that will are #36's, and they arrive with the cookie and the
     * loader modules that read it. So the exception is exercised against a
     * manifest of this test's own, which is also what proves the DEFAULT is
     * `drop`: the same entry with the field left out behaves as ADR 0012's
     * rule.
     *
     * @param array<string, mixed> $extra
     */
    private static function withACartCondition(array $extra): RuleVocabulary
    {
        return RuleVocabulary::fromArray([
            'triggers' => [
                'page_load' => ['kind' => 'trigger', 'tier' => 'free', 'params' => []],
            ],
            'conditions' => [
                'cart_has_items' => ['kind' => 'condition', 'tier' => 'pro', 'params' => []] + $extra,
            ],
        ]);
    }

    public function testAnOptinHoldingASuspendConditionItCannotEvaluateIsSuspended(): void
    {
        $free = InstalledRules::free(self::withACartCondition(['on_absence' => 'suspend']));
        $rules = [['type' => 'page_load'], ['type' => 'cart_has_items']];

        $this->assertSame('cart_has_items', $free->suspendedBy($rules));
        $this->assertNull($free->intoPayload([
            'id' => '01A',
            'triggers' => [['type' => 'page_load']],
            'conditions' => [['type' => 'cart_has_items']],
        ]));
    }

    /** An entry omitting the field behaves as ADR 0012's rule: it is dropped. */
    public function testAnEntryOmittingOnAbsenceIsDropped(): void
    {
        $free = InstalledRules::free(self::withACartCondition([]));
        $rules = [['type' => 'page_load'], ['type' => 'cart_has_items']];

        $this->assertNull($free->suspendedBy($rules));
        $this->assertSame([['type' => 'page_load']], $free->intoConfig($rules));
    }

    /**
     * **Computed, and self-healing.** Same `config`, a registry that has the
     * type back, and the Optin runs — with nothing stored anywhere to repair.
     */
    public function testTheSameConfigResumesWhenTheRegistryHasTheTypeBack(): void
    {
        $vocabulary = self::withACartCondition(['on_absence' => 'suspend']);
        $rules = [['type' => 'page_load'], ['type' => 'cart_has_items']];

        $this->assertSame('cart_has_items', InstalledRules::free($vocabulary)->suspendedBy($rules));
        $this->assertNull(InstalledRules::withPro($vocabulary)->suspendedBy($rules));
    }

    // ========================================================================
    // AN INSTALL THAT SUPPLIES EVERYTHING DEGRADES NOTHING.
    // ========================================================================

    public function testWithProInstalledEveryRuleIsLeftExactlyAsItWasAuthored(): void
    {
        $rules = [['type' => 'exit_intent'], ['type' => 'query_param', 'key' => 'utm_source', 'value' => ['spring']]];
        $withPro = InstalledRules::withPro();

        $this->assertSame($rules, $withPro->intoConfig($rules));
        $this->assertNull($withPro->suspendedBy($rules));
    }

    // ========================================================================
    // TWO CALL SITES, AND THEY NEVER PROCESS THE SAME OPTIN.
    // ========================================================================

    /**
     * Prefill covers Optins authored on an install WITHOUT Pro; enqueue covers
     * those authored WITH it and now running without. What makes them disjoint
     * in the code rather than only in the prose is that prefill BAKES the
     * substitution into `config` — so by the time enqueue sees such an Optin
     * there is nothing premium left to resolve, and the second pass is a
     * no-op it can be run through safely.
     */
    public function testWhatPrefillBakedInPassesThroughEnqueueUntouched(): void
    {
        $free = InstalledRules::free();
        $baked = $free->intoConfig([['type' => 'exit_intent'], ['type' => 'query_param', 'key' => 'utm_source']]);

        $this->assertNull($free->suspendedBy($baked));
        $this->assertSame($baked, $free->intoConfig($baked));
    }

    // ========================================================================
    // THE ENQUEUE HALF: A PAYLOAD ENTRY IN, A PAYLOAD ENTRY OUT.
    // ========================================================================

    public function testTheEntryComesBackWithBothAxesRepartitionedAroundTheSubstitution(): void
    {
        $entry = [
            'id' => '01A',
            'display_type' => 'popup',
            'triggers' => [['type' => 'exit_intent']],
            'conditions' => [['type' => 'query_param', 'key' => 'utm_source']],
        ];

        $this->assertSame(
            [
                'id' => '01A',
                'display_type' => 'popup',
                'triggers' => [['type' => 'time_on_page', 'seconds' => 15]],
                'conditions' => [],
            ],
            InstalledRules::free()->intoPayload($entry)
        );
    }

    /**
     * **And it carries no marker.** The marker is the builder's, and nothing
     * that renders an Optin reads it — on the page it would be bytes with no
     * reader, inlined into every matching page against a 2KB budget.
     */
    public function testThePayloadCarriesNoRecordOfTheSubstitution(): void
    {
        $entry = InstalledRules::free()->intoPayload([
            'id' => '01A',
            'triggers' => [['type' => 'exit_intent']],
        ]);

        $this->assertSame([['type' => 'time_on_page', 'seconds' => 15]], $entry['triggers'] ?? null);
    }

    /** An entry that needed nothing doing to it comes back as it went in. */
    public function testAnEntryWithNothingToDegradeIsUnchanged(): void
    {
        $entry = ['id' => '01A', 'triggers' => [['type' => 'page_load']], 'conditions' => []];

        $this->assertSame($entry, InstalledRules::free()->intoPayload($entry));
    }
}
