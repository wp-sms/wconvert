<?php
namespace WConvert\Tests\Unit\Rules;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\DisplayPlan;
use WConvert\Rules\RuleVocabulary;
use WConvert\Targeting\RequestContext;

final class DisplayPlanTest extends TestCase
{
    public function testServerFactsPreserveAlternativeAudienceBranches(): void
    {
        $plan = ['audience' => ['mode' => 'groups', 'groups' => [
            ['id' => 'a', 'match' => 'all', 'rules' => [
                ['id' => 'login', 'type' => 'logged_in', 'value' => true],
                ['id' => 'phone', 'type' => 'device', 'in' => ['mobile']],
            ]],
            ['id' => 'b', 'match' => 'any', 'rules' => [
                ['id' => 'role', 'type' => 'role', 'value' => ['subscriber']],
                ['id' => 'desktop', 'type' => 'device', 'in' => ['desktop']],
            ]],
        ]], 'opening' => ['mode' => 'immediate']];
        $reduced = DisplayPlan::forRequest($plan, new RequestContext());
        self::assertCount(1, $reduced['audience']['groups']);
        self::assertSame('device', $reduced['audience']['groups'][0]['rules'][0]['type']);
        self::assertSame(['mode' => 'everyone'], DisplayPlan::forRequest($plan,
            new RequestContext(isLoggedIn: true, roles: ['subscriber']))['audience']);
    }
    public function testUnknownRulesAreRejectedAndKnownIncompleteDraftsRemainRepairable(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $plan = ['audience' => ['mode' => 'everyone'], 'opening' => ['mode' => 'automatic', 'match' => 'all',
            'rules' => [['id' => 't', 'type' => 'time_on_page']]]];
        self::assertNotEmpty(DisplayPlan::issues(DisplayPlan::normalize($plan, $vocabulary), $vocabulary));
        $plan['opening']['rules'][0]['type'] = 'unknown';
        $this->expectException(\InvalidArgumentException::class);
        DisplayPlan::normalize($plan, $vocabulary);
    }
    public function testPortableSelectorsMatchTheSharedContract(): void
    {
        $cases = json_decode((string) file_get_contents(__DIR__ . '/../../fixtures/display/selectors.json'), true);
        foreach ($cases as [$selector, $valid]) self::assertSame($valid, DisplayPlan::validSelector($selector), $selector);
    }

    public function testAdBlockingRequiresADeclaredStatusAndRejectsContradictoryAllGroup(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $plan = ['audience' => ['mode' => 'groups', 'groups' => [[
            'id' => 'group', 'match' => 'all', 'rules' => [
                ['id' => 'detected', 'type' => 'ad_blocking', 'value' => 'detected'],
            ],
        ]]], 'opening' => ['mode' => 'immediate']];
        self::assertSame([], DisplayPlan::issues($plan, $vocabulary));
        $plan['audience']['groups'][0]['rules'][0]['value'] = 'maybe';
        self::assertNotEmpty(DisplayPlan::issues($plan, $vocabulary));
        $plan['audience']['groups'][0]['rules'][0]['value'] = 'detected';
        $plan['audience']['groups'][0]['rules'][] = ['id' => 'clear', 'type' => 'ad_blocking', 'value' => 'not_detected'];
        self::assertNotEmpty(DisplayPlan::issues($plan, $vocabulary));
        $plan['audience']['groups'][0]['match'] = 'any';
        self::assertSame([], DisplayPlan::issues($plan, $vocabulary));
    }

    public function testContradictionsAreRepairableDraftsButCannotPublish(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $plan = DisplayPlan::fromCatalogue([['type' => 'page_load'], ['type' => 'device', 'in' => ['mobile']], ['type' => 'device', 'in' => ['desktop']]], $vocabulary);
        self::assertNotEmpty(DisplayPlan::issues($plan, $vocabulary));
        $plan['audience']['groups'][0]['match'] = 'any';
        self::assertSame([], DisplayPlan::issues($plan, $vocabulary));
        $plan = DisplayPlan::fromCatalogue([['type' => 'page_load'], ['type' => 'query_param', 'key' => 'utm_source']], $vocabulary);
        self::assertSame([], DisplayPlan::issues($plan, $vocabulary), 'No value means presence of any value.');
    }

    /**
     * @param list<array<string, mixed>> $rules
     * @return array<string, mixed>
     */
    private static function audience(array $rules, string $match = 'all'): array
    {
        return ['audience' => ['mode' => 'groups', 'groups' => [['id' => 'g', 'match' => $match, 'rules' => $rules]]], 'opening' => ['mode' => 'immediate']];
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function negatableLeaves(): iterable
    {
        yield 'device' => [['type' => 'device', 'in' => ['mobile']]];
        yield 'role' => [['type' => 'role', 'value' => ['editor']]];
        yield 'time of day' => [['type' => 'time_of_day', 'between' => '09:00-17:00']];
        yield 'referrer' => [['type' => 'referrer', 'in' => ['search']]];
        yield 'query param' => [['type' => 'query_param', 'key' => 'utm_source']];
        yield 'cart' => [['type' => 'cart_has_items']];
        yield 'cart total' => [['type' => 'cart_value_min', 'amount' => 50]];
        yield 'quantity' => [['type' => 'cart_quantity', 'range' => ['operator' => 'min', 'min' => 2]]];
        yield 'amount' => [['type' => 'cart_amount', 'range' => ['operator' => 'min', 'min' => 20]]];
    }

    /**
     * "is not" is a leaf flag (ADR 0139), stored only when true and kept
     * through normalize — it was a key `leaves()` did not know, so it would
     * have been refused, and once allowed it would have been dropped by the
     * rebuilt row.
     *
     * @param array<string, mixed> $rule
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('negatableLeaves')]
    public function testANegatableAudienceLeafKeepsItsNegation(array $rule): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $plan = DisplayPlan::normalize(self::audience([['id' => 'r'] + $rule + ['negate' => true]]), $vocabulary);

        self::assertTrue($plan['audience']['groups'][0]['rules'][0]['negate']);
        self::assertSame($plan, DisplayPlan::normalize($plan, $vocabulary), 'normalize is a fixed point');
    }

    public function testAFalseNegationIsNotStored(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $plan = DisplayPlan::normalize(self::audience([['id' => 'r', 'type' => 'device', 'in' => ['mobile'], 'negate' => false]]), $vocabulary);

        self::assertArrayNotHasKey('negate', $plan['audience']['groups'][0]['rules'][0]);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function refusedNegations(): iterable
    {
        yield 'a trigger' => [['audience' => ['mode' => 'everyone'], 'opening' => ['mode' => 'automatic', 'match' => 'any', 'minimum_seconds' => 0,
            'rules' => [['id' => 't', 'type' => 'time_on_page', 'seconds' => 5, 'negate' => true]]]]];
        yield 'sign-in status, which has its own opposite' => [self::audience([['id' => 'r', 'type' => 'logged_in', 'value' => true, 'negate' => true]])];
        yield 'a type with none-of instead' => [self::audience([['id' => 'r', 'type' => 'cart_products', 'ids' => [1], 'operator' => 'any', 'negate' => true]])];
        yield 'a string' => [self::audience([['id' => 'r', 'type' => 'device', 'in' => ['mobile'], 'negate' => 'yes']])];
    }

    /** @param array<string, mixed> $plan */
    #[\PHPUnit\Framework\Attributes\DataProvider('refusedNegations')]
    public function testANegationIsRefusedWhereItCannotApply(array $plan): void
    {
        $this->expectException(\InvalidArgumentException::class);
        DisplayPlan::normalize($plan, RuleVocabulary::fromManifest(__DIR__ . '/../../..'));
    }

    /**
     * A negated device takes its set away from what is left, rather than
     * narrowing to it: "not a phone" and "a phone" leave nothing.
     */
    public function testANegatedDeviceContradictsWhatItTakesAway(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $phone = ['id' => 'a', 'type' => 'device', 'in' => ['mobile']];
        $notPhone = ['id' => 'b', 'type' => 'device', 'in' => ['mobile'], 'negate' => true];
        $notComputers = ['id' => 'c', 'type' => 'device', 'in' => ['tablet', 'desktop'], 'negate' => true];

        self::assertNotEmpty(DisplayPlan::issues(self::audience([$phone, $notPhone]), $vocabulary));
        self::assertSame([], DisplayPlan::issues(self::audience([$phone, $notComputers]), $vocabulary), 'not a tablet or computer leaves a phone');
        self::assertNotEmpty(DisplayPlan::issues(self::audience([$notPhone, $notComputers]), $vocabulary), 'nothing is left');
        self::assertSame([], DisplayPlan::issues(self::audience([$phone, $notPhone], 'any'), $vocabulary), 'ANY is never a contradiction');
    }

    public function testTheSameRuleBothWaysIsAContradiction(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $cart = ['id' => 'a', 'type' => 'cart_has_items'];
        $empty = ['id' => 'b', 'type' => 'cart_has_items', 'negate' => true];
        $editor = ['id' => 'c', 'type' => 'role', 'value' => ['editor']];
        $notEditor = ['id' => 'd', 'type' => 'role', 'value' => ['editor'], 'negate' => true];
        $notAuthor = ['id' => 'e', 'type' => 'role', 'value' => ['author'], 'negate' => true];

        self::assertNotEmpty(DisplayPlan::issues(self::audience([$cart, $empty]), $vocabulary));
        self::assertNotEmpty(DisplayPlan::issues(self::audience([$editor, $notEditor]), $vocabulary));
        self::assertSame([], DisplayPlan::issues(self::audience([$editor, $notAuthor]), $vocabulary));
    }

    /** No raw keys in messages (ADR 0131): the setting by its own name. */
    public function testAnIncompleteSettingIsNamedByItsLabel(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(__DIR__ . '/../../..');
        $issues = DisplayPlan::issues(self::audience([['id' => 'a', 'type' => 'device', 'in' => []]]), $vocabulary);

        self::assertSame(['Device: complete the Shows on value.'], $issues);
    }

    /**
     * "User role is not Editor" is answered on the server, so the negation is
     * applied there, before the group's all/any short-circuits.
     */
    public function testANegatedRoleIsAnsweredOnTheServer(): void
    {
        $notEditor = ['id' => 'r', 'type' => 'role', 'value' => ['editor'], 'negate' => true];
        $phone = ['id' => 'p', 'type' => 'device', 'in' => ['mobile']];
        $editor = new RequestContext(isLoggedIn: true, roles: ['editor']);
        $visitor = new RequestContext();

        // ALL: an editor fails the group; anyone else keeps the client-side rule.
        self::assertNull(DisplayPlan::forRequest(self::audience([$notEditor, $phone]), $editor));
        self::assertSame([$phone], DisplayPlan::forRequest(self::audience([$notEditor, $phone]), $visitor)['audience']['groups'][0]['rules']);
        // ANY: anyone but an editor satisfies the group, which collapses to everyone.
        self::assertSame(['mode' => 'everyone'], DisplayPlan::forRequest(self::audience([$notEditor, $phone], 'any'), $visitor)['audience']);
        self::assertSame([$phone], DisplayPlan::forRequest(self::audience([$notEditor, $phone], 'any'), $editor)['audience']['groups'][0]['rules']);
        // Alone, it decides the whole audience.
        self::assertSame(['mode' => 'everyone'], DisplayPlan::forRequest(self::audience([$notEditor]), $visitor)['audience']);
        self::assertNull(DisplayPlan::forRequest(self::audience([$notEditor]), $editor));
    }
}
