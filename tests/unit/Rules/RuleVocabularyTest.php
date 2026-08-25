<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleKind;
use WConvert\Rules\RuleVocabulary;

/**
 * The manifest, read as a vocabulary — and the partition that reads it.
 *
 * ADR 0005: "Rules are partitioned into `triggers` and `conditions` at publish
 * time, not at evaluation time. Kind is a fixed property of the type, so the
 * manifest already knows the answer and the client should not re-derive it per
 * page view." This is the object that knows the answer.
 */
#[CoversClass(RuleVocabulary::class)]
final class RuleVocabularyTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function vocabulary(): RuleVocabulary
    {
        return RuleVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    public function testKindComesFromTheManifest(): void
    {
        $vocabulary = self::vocabulary();

        $this->assertSame(RuleKind::Trigger, $vocabulary->kindOf('time_on_page'));
        $this->assertSame(RuleKind::Condition, $vocabulary->kindOf('device'));
        $this->assertSame(RuleKind::Page, $vocabulary->kindOf('url'));
        $this->assertNull($vocabulary->kindOf('nothing_of_the_sort'));
    }

    public function testAFlatRuleListIsPartitionedByTheTypesDeclaredKind(): void
    {
        $partitioned = self::vocabulary()->partition([
            ['type' => 'device', 'in' => ['desktop']],
            ['type' => 'time_on_page', 'seconds' => 10],
            ['type' => 'page_load'],
        ]);

        $this->assertSame(
            [['type' => 'time_on_page', 'seconds' => 10], ['type' => 'page_load']],
            $partitioned['triggers']
        );
        $this->assertSame([['type' => 'device', 'in' => ['desktop']]], $partitioned['conditions']);
    }

    /**
     * The vocabulary is closed (ADR 0005), so a type it does not know is a
     * mistake rather than an extension. Dropping it at publish is what stops it
     * reaching a payload nothing can evaluate — where a stray CONDITION would
     * fail shut and suspend the Optin for a reason that is a bug.
     */
    public function testAnUnknownTypeIsDroppedRatherThanCarried(): void
    {
        $partitioned = self::vocabulary()->partition([
            ['type' => 'page_load'],
            ['type' => 'astrological_sign', 'is' => 'leo'],
        ]);

        $this->assertSame([['type' => 'page_load']], $partitioned['triggers']);
        $this->assertSame([], $partitioned['conditions']);
    }

    /**
     * A Targeting type is a known type on the WRONG axis. It is answered on the
     * server and stripped from the payload, so finding one in the client rule
     * list means it would be evaluated twice or not at all.
     */
    public function testATargetingTypeIsNotAClientRule(): void
    {
        $partitioned = self::vocabulary()->partition([
            ['type' => 'url', 'value' => '/pricing'],
            ['type' => 'logged_in', 'value' => true],
            ['type' => 'page_load'],
        ]);

        $this->assertSame([['type' => 'page_load']], $partitioned['triggers']);
        $this->assertSame([], $partitioned['conditions']);
    }

    /**
     * @return iterable<string, array{mixed}>
     */
    public static function unusableRuleLists(): iterable
    {
        yield 'not a list at all' => ['triggers, obviously'];
        yield 'entries that are not arrays' => [['page_load', 42]];
        yield 'entries with no type' => [[['seconds' => 10]]];
        yield 'entries whose type is not a string' => [[['type' => ['page_load']]]];
    }

    /**
     * @param mixed $rules
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('unusableRuleLists')]
    public function testAnUnusableRuleListPartitionsIntoNothing($rules): void
    {
        $this->assertSame(['triggers' => [], 'conditions' => []], self::vocabulary()->partition($rules));
    }

    /**
     * The write path's view of the same question: still flat, but with the
     * typos gone before they can be published into a payload nothing can
     * evaluate.
     *
     * And still in the merchant's order — partitioning and re-flattening would
     * shuffle their rules into triggers-then-conditions on every save, on a
     * screen they look at.
     */
    public function testNormalizeDropsWhatPartitionWouldDropAndKeepsTheOrder(): void
    {
        $normalized = self::vocabulary()->normalize([
            ['type' => 'device', 'in' => ['desktop']],
            ['type' => 'astrological_sign', 'is' => 'leo'],
            ['type' => 'page_load'],
        ]);

        $this->assertSame(
            [['type' => 'device', 'in' => ['desktop']], ['type' => 'page_load']],
            $normalized
        );
    }

    /**
     * @return iterable<string, array{mixed}>
     */
    public static function unusableRuleListsForNormalize(): iterable
    {
        return self::unusableRuleLists();
    }

    /**
     * @param mixed $rules
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('unusableRuleListsForNormalize')]
    public function testAnUnusableRuleListNormalizesToNothing($rules): void
    {
        $this->assertSame([], self::vocabulary()->normalize($rules));
    }

    /**
     * **Every Optin has at least one [[Trigger]], and "shows immediately" is
     * the explicit `page_load` one rather than an empty list** (CONTEXT.md,
     * Trigger).
     *
     * Asked of the vocabulary rather than counted at each call site, because
     * there are two and they must agree: the [[Playbook]] registry refuses an
     * entry that would prefill an Optin with none, and the save route refuses
     * the same state arriving from the builder. An Optin with no Trigger can
     * never fire — a silent, total loss of function with nothing in any log,
     * which ADR 0012 names as this category's defining support ticket.
     */
    public function testARuleListNamesATriggerOnlyWhenOneOfItsTypesIsOne(): void
    {
        $vocabulary = self::vocabulary();

        $this->assertTrue($vocabulary->hasTrigger([['type' => 'page_load']]));
        $this->assertTrue($vocabulary->hasTrigger([['type' => 'device', 'in' => ['mobile']], ['type' => 'page_load']]));

        $this->assertFalse($vocabulary->hasTrigger([]));
        $this->assertFalse($vocabulary->hasTrigger([['type' => 'device', 'in' => ['mobile']]]));

        // A Targeting rule is not a Trigger however it is spelled, and neither
        // is a type the vocabulary does not have: both would leave an Optin
        // that can never fire while looking like one that can.
        $this->assertFalse($vocabulary->hasTrigger([['type' => 'url', 'value' => '/shop/*']]));
        $this->assertFalse($vocabulary->hasTrigger([['type' => 'moon_phase']]));
    }

    /**
     * A param the type does not declare is dropped on the way in, for the same
     * reason the type itself is: the vocabulary is closed, and a key no loader
     * module reads is a rule that silently never holds. Three of the four
     * bundled Playbooks shipped exactly that — `value` where the module reads
     * `seconds` — which is what put the declaration in the manifest.
     */
    public function testAParamTheTypeDoesNotDeclareIsDropped(): void
    {
        $this->assertSame(
            [['type' => 'time_on_page', 'seconds' => 8]],
            self::vocabulary()->normalize([['type' => 'time_on_page', 'seconds' => 8, 'value' => 8, 'nonsense' => 1]])
        );
    }
}
