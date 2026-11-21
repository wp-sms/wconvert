<?php

namespace WConvert\Tests\Unit\Storage;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Storage\WpOptionStore;

/**
 * The option seam on a `wp_options` table that cannot hold a 4-byte character.
 *
 * utf8mb3 is still what many older installs have. On one, WordPress refuses
 * to store an emoji at all: wpdb strips it, sees the value changed, and sends
 * no query (#424). So whatever merchant text goes through this seam has to
 * reach the table as ASCII.
 */
#[CoversClass(WpOptionStore::class)]
final class WpOptionStoreTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestOptionTable'] = [];
        $GLOBALS['wconvertTestOptionCharset'] = 'utf8mb3';
    }

    protected function tearDown(): void
    {
        wconvertTestOptionsAccept();
        $GLOBALS['wconvertTestOptionTable'] = [];
    }

    public function testAnEmojiSurvivesAUtf8mb3Table(): void
    {
        $store = new WpOptionStore();
        $value = ['headline' => 'Free shipping 😀', 'nested' => ['ok' => true, 'n' => 3]];

        $this->assertTrue($store->set('wconvert_example', $value));
        $this->assertSame($value, $store->get('wconvert_example'));
    }

    public function testWhatReachesTheTableIsAscii(): void
    {
        (new WpOptionStore())->set('wconvert_example', ['headline' => 'Café 😀']);

        $stored = $GLOBALS['wconvertTestOptionTable']['wconvert_example'] ?? null;

        $this->assertIsString($stored);
        $this->assertSame(0, preg_match('/[\x80-\xFF]/', $stored));
    }

    public function testAnArrayStoredTheOldWayStillReadsBack(): void
    {
        $GLOBALS['wconvertTestOptionTable']['wconvert_example'] = ['a' => 1];

        $this->assertSame(['a' => 1], (new WpOptionStore())->get('wconvert_example'));
    }

    public function testAScalarIsStoredAndReadAsItIs(): void
    {
        $store = new WpOptionStore();
        $store->set('wconvert_version', '6');
        $store->set('wconvert_consent', 'yes');

        $this->assertSame('6', $store->get('wconvert_version'));
        $this->assertSame('yes', $store->get('wconvert_consent'));
    }

    public function testTheDefaultComesBackForAMissingOption(): void
    {
        $this->assertSame([], (new WpOptionStore())->get('wconvert_missing', []));
    }

    public function testARefusedWriteIsReported(): void
    {
        $GLOBALS['wconvertTestRefusedOptions'] = ['wconvert_example'];

        $this->assertFalse((new WpOptionStore())->set('wconvert_example', ['a' => 1]));
    }

    /**
     * `update_option()` answers false for a value that did not change too.
     * That is not a failure: what is stored is already what was asked for.
     */
    public function testWritingTheSameValueTwiceIsNotAFailure(): void
    {
        $store = new WpOptionStore();
        $store->set('wconvert_example', ['a' => 1]);

        $this->assertTrue($store->set('wconvert_example', ['a' => 1]));
        $this->assertTrue($store->set('wconvert_version', '6'));
        $this->assertTrue($store->set('wconvert_version', '6'));
    }
}
