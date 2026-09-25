<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\JourneyRules;

final class JourneyRulesTest extends TestCase
{
    public function testPhpAndBrowserUseTheSamePathAndResultFixtures(): void
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/journey-rules.json'), true);
        $steps = $fixture['steps'];
        foreach ($fixture['cases'] as $case) {
            $active = JourneyRules::activeAnswers($steps, $case['answers']);
            self::assertSame($case['active'], $active);
            self::assertSame($case['visible'], array_values(array_map(
                static fn (array $step): string => $step['id'],
                array_filter($steps, static fn (array $step): bool => JourneyRules::matches($step['when'] ?? null, $active))
            )));
            self::assertSame($case['result'], JourneyRules::result($steps[3]['results'], $active)['id']);
        }
        self::assertFalse(JourneyRules::matches(['match' => 'all', 'clauses' => [
            ['question' => 'q_project', 'operator' => 'is_not', 'values' => ['garden']],
        ]], []));
    }

    public function testForwardPathsMatchTheBrowserFixtures(): void
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/journey-paths.json'), true);
        foreach ($fixture['cases'] as $case) {
            $path = JourneyRules::path($fixture['steps'], $case['answers']);
            self::assertSame($case['visible'], array_map(static fn (int $at): string => $fixture['steps'][$at]['id'], $path['indices']));
            self::assertSame($case['active'], $path['answers']);
        }
        $steps = $fixture['steps'];
        $condition = static fn (string $value): array => ['match' => 'all', 'clauses' => [
            ['question' => 'q_interest', 'operator' => 'includes_any', 'values' => [$value]],
        ]];
        $steps[0]['paths'] = [['to' => 'garden', 'when' => $condition('garden')], ['to' => 'indoors', 'when' => $condition('indoors')], ['to' => 'contact']];
        $steps[1]['paths'] = [['to' => 'contact']];
        $path = JourneyRules::path($steps, ['q_interest' => ['garden', 'indoors'], 'q_garden' => 'small', 'q_indoor' => 'bright']);
        self::assertSame(['interests', 'garden', 'contact', 'received'], array_map(static fn (int $at): string => $steps[$at]['id'], $path['indices']));
        self::assertSame(['q_interest' => ['garden', 'indoors'], 'q_garden' => 'small'], $path['answers']);
        $steps = $fixture['steps'];
        $steps[1]['paths'] = [['to' => 'contact']];
        $path = JourneyRules::path($steps, ['q_interest' => ['indoors'], 'q_indoor' => 'bright']);
        self::assertSame(['interests', 'indoors', 'contact', 'received'], array_map(static fn (int $at): string => $steps[$at]['id'], $path['indices']));
    }

    public function testMultipleChosenAnswersCanMatchOneCondition(): void
    {
        $condition = ['match' => 'all', 'clauses' => [[
            'question' => 'q_interest', 'operator' => 'includes_any', 'values' => ['garden', 'indoors'],
        ]]];
        self::assertSame($condition, JourneyRules::normalize($condition));
        self::assertTrue(JourneyRules::matches($condition, ['q_interest' => ['indoors']]));
        self::assertFalse(JourneyRules::matches($condition, ['q_interest' => ['other']]));
        $condition['clauses'][0]['operator'] = 'includes_none';
        self::assertTrue(JourneyRules::matches($condition, ['q_interest' => ['other']]));
        self::assertFalse(JourneyRules::matches($condition, ['q_interest' => ['indoors', 'other']]));
        self::assertFalse(JourneyRules::matches($condition, []));
        $condition['clauses'][0]['values'] = ['garden', 'garden'];
        self::assertNull(JourneyRules::normalize($condition));
        $condition['clauses'][0]['operator'] = 'is';
        self::assertNull(JourneyRules::normalize($condition));
    }
}
