<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationUsage;
use WConvert\Tests\Unit\Support\FakeConnection;

final class DestinationUsageTest extends TestCase
{
    public function testUsageDistinguishesSavedDraftAndLiveBindingsWithoutIncludingDeletedOrPausedLiveCopies(): void
    {
        $route = '01J0000000AAAAAAAAAAAAAAAA';
        $config = (string) json_encode(['destinations' => [$route, $route, 'not-an-id']]);
        $db = new FakeConnection();
        $db->rows = [
            'draft' => ['id' => 'draft', 'name' => 'Draft enquiry', 'config' => $config, 'published_config' => null, 'published_at' => null],
            'live' => ['id' => 'live', 'name' => 'Live newsletter', 'config' => '{}', 'published_config' => $config, 'published_at' => '2026-09-11 10:00:00'],
            'both' => ['id' => 'both', 'name' => 'Both versions', 'config' => $config, 'published_config' => $config, 'published_at' => '2026-09-11 10:00:00'],
            'paused' => ['id' => 'paused', 'name' => 'Paused', 'config' => '{}', 'published_config' => $config, 'published_at' => null],
            'deleted' => ['id' => 'deleted', 'name' => 'Deleted', 'config' => $config, 'deleted_at' => '2026-09-11 11:00:00'],
            'broken' => ['id' => 'broken', 'name' => 'Broken', 'config' => 'not json'],
        ];
        $usage = (new DestinationUsage($db))->all();
        self::assertSame([$route], array_keys($usage));
        self::assertSame([
            ['id' => 'live', 'name' => 'Live newsletter', 'draft' => false, 'live' => true],
            ['id' => 'draft', 'name' => 'Draft enquiry', 'draft' => true, 'live' => false],
            ['id' => 'both', 'name' => 'Both versions', 'draft' => true, 'live' => true],
        ], $usage[$route]);
        self::assertCount(1, $db->reads);
        self::assertStringContainsString('WHERE deleted_at IS NULL', $db->reads[0]['sql']);
        self::assertSame([], $db->writes);
    }
}
