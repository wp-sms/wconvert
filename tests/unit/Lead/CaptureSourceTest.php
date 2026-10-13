<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\TestCase;
use WConvert\Lead\CaptureSource;

/** The page a Lead signed up on keeps its path and its UTM tags, and nothing else a URL can carry. */
final class CaptureSourceTest extends TestCase
{
    public function testOnlyThePathAndTheFiveUtmTagsSurvive(): void
    {
        self::assertSame([
            'page_url' => '/pricing?utm_source=fb&utm_campaign=spring%20sale',
            'utm' => ['source' => 'fb', 'medium' => null, 'campaign' => 'spring sale', 'term' => null, 'content' => null],
        ], CaptureSource::fromPageUrl('/pricing?email=sarah%40example.com&utm_source=fb&token=abc&utm_campaign=spring+sale#top'));
    }

    public function testAnAbsoluteUrlLosesItsSchemeAndHost(): void
    {
        self::assertSame('/', CaptureSource::fromPageUrl('https://shop.example/?gclid=1')['page_url']);
    }

    public function testATagWithAnArrayValueOrAnOverlongOneIsDropped(): void
    {
        $source = CaptureSource::fromPageUrl('/a?utm_source[]=x&utm_medium=' . str_repeat('m', 201));
        self::assertSame('/a', $source['page_url']);
        self::assertSame(['source' => null, 'medium' => null, 'campaign' => null, 'term' => null, 'content' => null], $source['utm']);
    }

    public function testAnythingThatIsNotAPagePathIsNoSource(): void
    {
        foreach ([null, 42, '', 'javascript:alert(1)', '//evil.example/x', 'pricing', '/' . str_repeat('p', 600)] as $value) {
            self::assertNull(CaptureSource::fromPageUrl($value), var_export($value, true));
        }
    }
}
