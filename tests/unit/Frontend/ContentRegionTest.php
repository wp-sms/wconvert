<?php
namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\ContentRegion;

/**
 * What the content lock block and shortcode print.
 *
 * The second WordPress.org review (October 2026) asked for the markup to be
 * escaped AFTER the `wconvert_content_region_html` filter, since whatever a
 * filter returns is what the page prints.
 */
#[CoversClass(ContentRegion::class)]
final class ContentRegionTest extends TestCase
{
    private const ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestFilters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestFilters'] = [];
    }

    public function testWhatAFilterReturnsIsEscapedBeforeItIsOutput(): void
    {
        add_filter('wconvert_content_region_html', static fn (string $html): string => $html . '<script>alert(1)</script>');

        $html = ContentRegion::html(self::ID, '<p>Bonus</p>');

        self::assertStringNotContainsString('<script', $html);
        self::assertStringContainsString('<p>Bonus</p>', $html);
    }

    public function testTheShortcodeOutputIsEscapedAfterTheFilterToo(): void
    {
        add_filter('wconvert_content_region_html', static fn (string $html): string => $html . '<script>alert(1)</script>');

        $html = ContentRegion::shortcode(['id' => self::ID], '<p>Bonus</p>');

        self::assertStringNotContainsString('<script', $html);
    }

    /** Pro's content lock renames one attribute in the filter; that must survive. */
    public function testProsAttributeRenameStillReachesThePage(): void
    {
        add_filter('wconvert_content_region_html', static fn (string $html): string => str_replace('data-wconvert-region=', 'data-wconvert-content-lock=', $html));

        $html = ContentRegion::html(self::ID, '<p>Bonus</p>');

        self::assertStringContainsString('data-wconvert-content-lock="' . self::ID . '"', $html);
        self::assertStringContainsString('data-wconvert-locked-content', $html);
        self::assertStringContainsString('data-wconvert-optin="' . self::ID . '"', $html);
    }
}
