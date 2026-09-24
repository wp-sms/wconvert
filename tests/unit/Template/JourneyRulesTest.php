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
}
