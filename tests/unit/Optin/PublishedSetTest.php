<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedSet;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * A set the table would not take is not a changed set (#424).
 *
 * `wconvert_published_set_changed` purges the page cache. Firing it after a
 * refused write purges the cache only for it to fill again with the old set,
 * and tells every listener something changed that did not.
 */
#[CoversClass(PublishedSet::class)]
final class PublishedSetTest extends TestCase
{
    private int $changes = 0;

    protected function setUp(): void
    {
        unset($GLOBALS['wconvertTestActions']['wconvert_published_set_changed']);
        add_action('wconvert_published_set_changed', function (): void { $this->changes++; });
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestActions']['wconvert_published_set_changed']);
    }

    /** @return list<array<string, mixed>> */
    private static function set(): array
    {
        return [[
            'id' => 'optin-1',
            'payload' => [
                'capture_contract' => 'rev-1',
                'template' => ['tree' => ['steps' => [['id' => 's1', 'name' => 'Ask 😀']]]],
            ],
        ]];
    }

    public function testAWrittenSetIsAnnounced(): void
    {
        $this->assertTrue((new PublishedSet(new FakeOptionStore()))->replaceWith(self::set()));
        $this->assertSame(1, $this->changes);
    }

    public function testARefusedSetIsReportedAndNotAnnounced(): void
    {
        $options = new FakeOptionStore();
        $options->refused = [PublishedSet::OPTION];

        $this->assertFalse((new PublishedSet($options))->replaceWith(self::set()));
        $this->assertSame(0, $this->changes);
    }

    public function testARefusedScreenListIsReportedAndNotAnnounced(): void
    {
        $options = new FakeOptionStore();
        $options->refused = ['wconvert_flow_optin-1_rev-1'];

        $this->assertFalse((new PublishedSet($options))->replaceWith(self::set()));
        $this->assertSame(0, $this->changes);
    }
}
