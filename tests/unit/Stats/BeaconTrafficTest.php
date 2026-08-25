<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\BeaconTraffic;

/**
 * Who gets counted: `Sec-Purpose`, bot user agent, and **no heuristics**.
 *
 * There is no identifier left on a stateless beacon to score a suspicious
 * request against (ADR 0017), so this believes requests that say what they are
 * and counts everything else. The direction of error is chosen rather than
 * accepted: an Impression counted that should not have been inflates the
 * denominator of conversion rate and makes the plugin look worse than it is,
 * which is the safe side to be wrong on.
 */
#[CoversClass(BeaconTraffic::class)]
final class BeaconTrafficTest extends TestCase
{
    private const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)'
        . ' Chrome/140.0.0.0 Safari/537.36';

    public function testARealBrowserIsCounted(): void
    {
        $this->assertTrue(BeaconTraffic::countable('', '', self::CHROME));
    }

    /**
     * A page fetched on the chance somebody navigates is a page nobody has
     * looked at. Chrome sends these exact values.
     */
    #[DataProvider('speculativeHeaders')]
    public function testASpeculativeFetchIsNotCounted(string $secPurpose, string $purpose): void
    {
        $this->assertFalse(BeaconTraffic::countable($secPurpose, $purpose, self::CHROME));
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function speculativeHeaders(): array
    {
        return [
            'prefetch' => ['prefetch', ''],
            'prerender' => ['prefetch;prerender', ''],
            'anonymous client ip prefetch' => ['prefetch;anonymous-client-ip', ''],
            'cased differently' => ['Prefetch;Prerender', ''],
            // The pre-standard header the same browsers sent before
            // `Sec-Purpose`, and the one Firefox still sends.
            'the old Purpose header' => ['', 'prefetch'],
            'the old header, cased and padded' => ['', ' Prefetch '],
        ];
    }

    #[DataProvider('bots')]
    public function testSomethingThatSaysItIsABotIsNotCounted(string $userAgent): void
    {
        $this->assertFalse(BeaconTraffic::countable('', '', $userAgent));
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function bots(): array
    {
        return [
            'googlebot' => ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
            'bingbot' => ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
            'ahrefs' => ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
            'yahoo' => ['Mozilla/5.0 (compatible; Yahoo! Slurp)'],
            'a crawler' => ['SomeCrawler/1.0'],
            'a spider' => ['Screaming Frog SEO Spider/19.0'],
            'headless chrome' => ['Mozilla/5.0 HeadlessChrome/140.0.0.0'],
            'lighthouse' => ['Mozilla/5.0 Chrome-Lighthouse'],
            'curl' => ['curl/8.7.1'],
            'wget' => ['Wget/1.21.4'],
            'a script that did not bother' => [''],
            'a script that sent whitespace' => ['   '],
        ];
    }

    /**
     * **The list is short on purpose, and this is what that costs.**
     *
     * A crawler that renders JavaScript and hides its identity gets counted.
     * That is a known and accepted inaccuracy rather than a gap: a list long
     * enough to catch an agent that lies is a list long enough to catch real
     * browsers, and a false positive here is a real Impression silently missing
     * from a number nobody can ever recompute (ADR 0019).
     */
    public function testSomethingPretendingToBeABrowserIsCounted(): void
    {
        $this->assertTrue(BeaconTraffic::countable('', '', 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/141.0'));
    }

    /**
     * The user agents of real people, none of which may be mistaken for a bot.
     *
     * `bot` is a substring match, which is the cheapest thing that works and
     * also the thing most likely to catch something innocent — so the browsers
     * a merchant's visitors actually use are pinned here.
     */
    #[DataProvider('realBrowsers')]
    public function testARealVisitorIsNeverMistakenForABot(string $userAgent): void
    {
        $this->assertTrue(BeaconTraffic::countable('', '', $userAgent));
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function realBrowsers(): array
    {
        return [
            'chrome on mac' => [self::CHROME],
            'safari on iphone' => [
                'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
                    . ' Version/18.5 Mobile/15E148 Safari/604.1',
            ],
            'firefox on windows' => [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0',
            ],
            'edge' => [self::CHROME . ' Edg/140.0.0.0'],
            'samsung internet' => [
                'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0'
                    . ' Chrome/121.0.0.0 Mobile Safari/537.36',
            ],
        ];
    }

    /**
     * A prefetch made by a bot is dropped once, not twice — the two rules are
     * independent and either one is enough.
     */
    public function testTheTwoRulesAreIndependent(): void
    {
        $this->assertFalse(BeaconTraffic::countable('prefetch', '', 'Googlebot/2.1'));
    }
}
