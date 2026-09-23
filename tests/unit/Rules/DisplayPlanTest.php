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
}
