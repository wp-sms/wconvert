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
}
