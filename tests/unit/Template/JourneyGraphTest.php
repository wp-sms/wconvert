<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\JourneyGraph;

final class JourneyGraphTest extends TestCase
{
    public function testSharedGraphFixturesIgnoreStorageOrderAndKeepRelevantAnswers(): void
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/journey-graph.json'), true);
        foreach ($fixture['cases'] as $example) {
            $trace = JourneyGraph::trace($fixture['steps'], $fixture['graph'], $example['answers']);
            self::assertSame($example['visible'], array_map(static fn (int $index): string => $fixture['steps'][$index]['id'], $trace['indices']));
            self::assertSame($example['active'], $trace['answers']);
            self::assertSame($example['hidden'], $trace['hidden']);
            self::assertSame($example['edges'], array_column($trace['decisions'], 'edge'));
        }
    }

    public function testFirstMatchingAnswerEdgeWinsBeforeTheMerge(): void
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/journey-graph.json'), true);
        $when = static fn (string $answer): array => ['match' => 'all', 'clauses' => [[
            'question' => 'n1', 'operator' => 'includes_any', 'values' => [$answer],
        ]]];
        $graph = ['entry' => 'interests', 'edges' => [
            ['id' => 'indoor-first', 'from' => 'interests', 'to' => 'indoors', 'kind' => 'answer', 'when' => $when('indoors')],
            ['id' => 'garden-second', 'from' => 'interests', 'to' => 'garden', 'kind' => 'answer', 'when' => $when('garden')],
            ['id' => 'otherwise', 'from' => 'interests', 'to' => 'contact', 'kind' => 'default'],
            ['id' => 'indoor-merge', 'from' => 'indoors', 'to' => 'contact', 'kind' => 'default'],
            ['id' => 'garden-merge', 'from' => 'garden', 'to' => 'contact', 'kind' => 'default'],
            ['id' => 'finish', 'from' => 'contact', 'to' => 'received', 'kind' => 'default'],
        ]];
        $trace = JourneyGraph::trace($fixture['steps'], $graph, ['n1' => ['garden', 'indoors'], 'n2' => 'bright', 'n3' => 'small']);
        self::assertSame(['interests', 'indoors', 'contact', 'received'], array_map(static fn (int $index): string => $fixture['steps'][$index]['id'], $trace['indices']));
        self::assertSame('indoor-first', $trace['decisions'][0]['edge']);
        self::assertSame(0, $trace['decisions'][0]['priority']);
        self::assertSame(['n1' => ['garden', 'indoors'], 'n2' => 'bright'], $trace['answers']);
    }

    public function testGraphValidationRejectsCyclesMissingFallbackAndImpossibleSources(): void
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/journey-graph.json'), true);
        $tree = ['steps' => $fixture['steps'], 'graph' => $fixture['graph']];
        self::assertNull(JourneyGraph::issue($tree));
        self::assertTrue(JourneyGraph::reaches($tree['graph'], 'interests', 'received'));
        self::assertFalse(JourneyGraph::reaches($tree['graph'], 'received', 'interests'));
        $cycle = $tree;
        $cycle['graph']['edges'][] = ['id' => 'loop', 'from' => 'received', 'to' => 'interests', 'kind' => 'default'];
        self::assertSame('routes', JourneyGraph::issue($cycle));
        $missingFallback = $tree;
        $missingFallback['graph']['edges'] = array_values(array_filter($tree['graph']['edges'], static fn (array $edge): bool => $edge['id'] !== 'e1'));
        self::assertSame('routes', JourneyGraph::issue($missingFallback));
        $unavailable = $tree;
        $unavailable['steps'][2]['when'] = ['match' => 'all', 'clauses' => [[
            'question' => 'n2', 'operator' => 'is', 'values' => ['bright'],
        ]]];
        $unavailable['graph']['edges'][] = ['id' => 'skip-entry', 'from' => 'interests', 'to' => 'garden', 'kind' => 'hidden'];
        self::assertSame('conditions', JourneyGraph::issue($unavailable));
        $missingAnswer = $tree;
        $missingAnswer['graph']['edges'][] = ['id' => 'unbound', 'from' => 'interests', 'to' => 'contact', 'kind' => 'answer'];
        self::assertSame('conditions', JourneyGraph::issue($missingAnswer));

        $partlyAvailable = $tree;
        $partlyAvailable['graph']['edges'][] = ['id' => 'indoor-shortcut', 'from' => 'interests', 'to' => 'indoors', 'kind' => 'answer', 'when' => [
            'match' => 'all', 'clauses' => [['question' => 'n1', 'operator' => 'includes_any', 'values' => ['indoors']]],
        ]];
        $partlyAvailable['graph']['edges'][] = ['id' => 'garden-answer', 'from' => 'contact', 'to' => 'received', 'kind' => 'answer', 'when' => [
            'match' => 'all', 'clauses' => [['question' => 'n3', 'operator' => 'is', 'values' => ['small']]],
        ]];
        self::assertNull(JourneyGraph::issue($partlyAvailable));
    }
}
