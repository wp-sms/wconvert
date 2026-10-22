<?php
namespace WConvert\Tests\Unit\Pro\Analytics;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\Analytics\Metadata;

final class MetadataTest extends TestCase
{
    public function testOnlyPublishedAllowlistedMetadataLeavesTheServer(): void
    {
        $entries = [['id' => 'child', 'display_type' => 'inline', 'template' => ['tree' => ['steps' => [['kind' => 'result']], 'submissions' => [['id' => 'email']]]]]];
        $set = [['id' => 'child', 'goal' => 'find_match', 'analytics_campaign' => 'parent', 'analytics' => ['label' => 'Quiz'], 'name' => 'Private name', 'email' => 'private@example.org']];
        self::assertSame(['child' => ['campaign' => 'parent', 'goal' => 'find_match', 'display' => 'inline', 'outcome' => 'quiz', 'label' => 'Quiz']], Metadata::forEntries($entries, $set));
        $set[0]['analytics']['off'] = true;
        self::assertSame([], Metadata::forEntries($entries, $set));
    }

    /** A message offers no act, so it is named `none` and sends no conversion event (ADR 0163). */
    public function testAMessageHasNoConversionOutcome(): void
    {
        $tree = ['steps' => [['kind' => 'content', 'content' => ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Open late']]]]], 'submissions' => []];
        $set = [['id' => 'm', 'goal' => 'show_message']];
        self::assertSame('none', Metadata::forEntries([['id' => 'm', 'template' => ['tree' => $tree]]], $set)['m']['outcome']);
        $tree['steps'][0]['content']['children'][] = ['type' => 'button', 'action' => 'link', 'href' => 'https://example.org/'];
        self::assertSame('click', Metadata::forEntries([['id' => 'm', 'template' => ['tree' => $tree]]], $set)['m']['outcome']);
    }
}
