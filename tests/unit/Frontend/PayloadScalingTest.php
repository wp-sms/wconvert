<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\Payload;
use WConvert\Frontend\PayloadTag;
use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;

/**
 * ADR 0029's payload assertion, as PHPUnit.
 *
 * The ADR asks for two things and this is the half that bites: **payload size
 * tracks matching Optins, not total published ones.** It is what catches a
 * refactor that drops the URL filter and turns 100 published Optins into 100
 * payload entries on every page.
 *
 * The 2KB bound itself is deliberately NOT asserted here. It is unreachable
 * against the placeholder payloads this ticket can build and would therefore
 * be inert; it lands with real template trees, in the template ticket.
 */
#[CoversClass(Payload::class)]
#[CoversClass(PayloadTag::class)]
final class PayloadScalingTest extends TestCase
{
    /**
     * A published set of $total Optins, of which exactly two are targeted at
     * `/pricing/` and the rest at pages that are not this one.
     *
     * @return list<PublishedOptin>
     */
    private static function publishedSet(int $total): array
    {
        $set = [];

        for ($i = 0; $i < $total; $i++) {
            $matches = $i < 2;

            $set[] = [
                'id' => sprintf('01JQ%022d', $i),
                'targeting' => [
                    'include' => [[
                        'type' => 'url',
                        'value' => $matches ? '/pricing' : sprintf('/campaign-%d', $i),
                    ]],
                ],
                'payload' => ['display_type' => 'popup', 'template_id' => 'centred-card'],
            ];
        }

        return PublishedOptin::fromSet($set);
    }

    private static function pricingPage(): RequestContext
    {
        return new RequestContext(path: '/pricing/');
    }

    private static function bytes(int $totalPublished): int
    {
        return strlen(PayloadTag::render(Payload::forRequest(self::publishedSet($totalPublished), self::pricingPage())));
    }

    public function testOnlyTheMatchingOptinsReachThePage(): void
    {
        $entries = Payload::forRequest(self::publishedSet(100), self::pricingPage());

        $this->assertCount(2, $entries);
    }

    /**
     * The property itself: ten published Optins, a hundred, a thousand — the
     * page carries the same bytes, because the same two match.
     */
    public function testPayloadSizeIsUnchangedByPublishedOptinsThatDoNotMatch(): void
    {
        $twoPublished = self::bytes(2);

        $this->assertSame($twoPublished, self::bytes(10));
        $this->assertSame($twoPublished, self::bytes(100));
        $this->assertSame($twoPublished, self::bytes(1000));
    }

    /**
     * The other side of the same property, so it cannot be satisfied by a
     * payload that is constant because it is empty: size DOES track matching
     * Optins.
     */
    public function testPayloadSizeGrowsWithTheOptinsThatDoMatch(): void
    {
        $set = self::publishedSet(100);
        $one = strlen(PayloadTag::render(Payload::forRequest([$set[0]], self::pricingPage())));

        $this->assertGreaterThan($one, self::bytes(100));
    }
}
