<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Lead\QuestionCapture;
use WConvert\Lead\Refusal;
use WConvert\Template\CaptureContract;
use WConvert\Template\JourneyGraph;
use WConvert\Template\JourneyRules;
use WConvert\Template\TemplateVocabulary;

final class CoffeeJourneyTest extends TestCase
{
    public function testAllCoffeeCombinationsKeepTheirRoutesResultsAndCaptureBoundaryAfterNormalization(): void
    {
        $fixture = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-coffee.json'), true);
        self::assertCount(48, $fixture['cases']);
        $tree = TemplateVocabulary::fromManifest()->normalize($fixture['template'])['tree'];
        if (!isset($tree['graph'])) {
            self::fail('A version 3 journey must retain its graph.');
        }
        self::assertSame($fixture['template']['tree']['graph'], $tree['graph']);
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $tree]], 'find_match', 'https://example.test/privacy'));
        $result = array_values(array_filter($tree['steps'], static fn (array $screen): bool => $screen['kind'] === 'result'))[0];
        foreach ($fixture['cases'] as $case) {
            $trace = JourneyGraph::trace($tree['steps'], $tree['graph'], $case['answers']);
            self::assertSame($case['visible'], array_map(static fn (int $index): string => $tree['steps'][$index]['id'], $trace['indices']), $case['name']);
            self::assertSame($case['active'], $trace['answers'], $case['name']);
            self::assertSame($case['result'], JourneyRules::result($result['results'], $trace['answers'])['id'], $case['name']);
            $accepted = QuestionCapture::validate($tree, $case['answers'], 'coffee-signup');
            self::assertIsArray($accepted);
            self::assertSame(array_keys(array_filter($case['active'], static fn ($answer): bool => $answer !== [])), array_column($accepted, 'id'), $case['name']);
            self::assertSame(['n1', 'n2', ...($case['answers']['n1'] === 'filter' ? ['n3'] : [])], QuestionCapture::coveredIds($tree, $accepted, 'coffee-signup'));
        }
        $missingGrinder = QuestionCapture::validate($tree, ['n1' => 'filter', 'n2' => ['bright']], 'coffee-signup');
        self::assertInstanceOf(Refusal::class, $missingGrinder);
    }
}
