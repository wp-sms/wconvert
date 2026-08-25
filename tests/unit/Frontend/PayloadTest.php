<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\Payload;
use WConvert\Frontend\PayloadTag;
use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;

/**
 * What the page actually receives: the published set, filtered to this
 * request, with the server-evaluated axis stripped rather than shipped
 * (ADR 0003, ADR 0005).
 */
#[CoversClass(Payload::class)]
#[CoversClass(PayloadTag::class)]
#[CoversClass(PublishedOptin::class)]
final class PayloadTest extends TestCase
{
    /** Where the capture endpoint is on this site, as `LoaderEnqueue` resolves it. */
    private const CAPTURE = 'https://example.test/wp-json/wconvert/v1/capture';

    private const BEACON = 'https://example.test/wp-json/wconvert/v1/beacon';

    /**
     * Built from the STORED shape rather than by hand, so these tests keep
     * exercising the parse the front end actually does.
     *
     * @param array<string, mixed> $targeting
     * @return list<PublishedOptin>
     */
    private static function projection(string $id, array $targeting): array
    {
        return PublishedOptin::fromSet([
            ['id' => $id, 'targeting' => $targeting, 'payload' => ['display_type' => 'popup']],
        ]);
    }

    public function testAnOptinTargetedAtOnePageIsPresentThereAndAbsentEverywhereElse(): void
    {
        $set = self::projection('01A', ['include' => [['type' => 'post', 'value' => 12]]]);

        $onTarget = new RequestContext(path: '/hello/', isSingular: true, postId: 12, postType: 'post');
        $elsewhere = new RequestContext(path: '/other/', isSingular: true, postId: 13, postType: 'post');

        $this->assertSame(['01A'], array_column(Payload::forRequest($set, $onTarget), 'id'));
        $this->assertSame([], Payload::forRequest($set, $elsewhere));
    }

    public function testTargetingIsStrippedFromWhatTheBrowserReceives(): void
    {
        $set = self::projection('01A', ['include' => [['type' => 'url', 'value' => '/secret-staging-path']]]);
        $context = new RequestContext(path: '/secret-staging-path/');

        $entries = Payload::forRequest($set, $context);

        $this->assertSame([['id' => '01A', 'display_type' => 'popup']], $entries);
        $this->assertStringNotContainsString('secret-staging-path', PayloadTag::render($entries, self::CAPTURE, self::BEACON));
    }

    /**
     * `<script type="application/json">` and nothing else. Every JS optimizer
     * tested selects on `script[!type]` or `type="text/javascript"`, so this
     * tag is invisible to all of them and survives aggregation in place
     * (ADR 0004).
     */
    public function testThePayloadTravelsAsAJsonScriptTag(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_type' => 'popup']], self::CAPTURE, self::BEACON);

        $this->assertStringStartsWith('<script type="application/json" id="wconvert-payload" ', $tag);
        $this->assertStringEndsWith('</script>', $tag);
        $this->assertStringContainsString('"01A"', $tag);
    }

    /**
     * The capture endpoint rides on the element rather than in the JSON: it is
     * one fact about the SITE, and repeating it per entry would pay for it as
     * many times as the page has Optins. The loader has no `wp-api-fetch` and
     * cannot compute it (ADR 0004).
     */
    public function testThePayloadCarriesWhereToPostACapture(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_type' => 'popup']], self::CAPTURE, self::BEACON);

        $this->assertStringContainsString(sprintf('data-capture="%s"', self::CAPTURE), $tag);
        $this->assertSame(1, substr_count($tag, 'data-capture'));
    }

    /**
     * And the beacon rides beside it, for the same reason and at the same
     * cost: one fact about the site, once per page rather than once per
     * Optin. The loader cannot compute this one either, and a namespace root
     * it appended `/beacon` to would be a route name spelled in TypeScript.
     */
    public function testThePayloadCarriesWhereToPostABeacon(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_type' => 'popup']], self::CAPTURE, self::BEACON);

        $this->assertStringContainsString(sprintf('data-beacon="%s"', self::BEACON), $tag);
        $this->assertSame(1, substr_count($tag, 'data-beacon'));
    }

    /**
     * A closing tag inside the copy must not end the script element early.
     * json_encode's JSON_HEX_TAG is what stops it, and this is the test that
     * notices the day someone drops the flag for smaller output.
     */
    public function testCopyContainingAClosingScriptTagCannotBreakOut(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'headline' => '</script><script>alert(1)</script>']], self::CAPTURE, self::BEACON);

        $this->assertSame(1, substr_count($tag, '</script>'));
        $this->assertStringNotContainsString('<script>alert', $tag);
    }

    /**
     * No matching Optin means no tag — not an empty one. An Optin that does
     * not match the current page costs the page nothing (ADR 0003).
     */
    public function testNoMatchingOptinPrintsNothingAtAll(): void
    {
        $this->assertSame('', PayloadTag::render([], self::CAPTURE, self::BEACON));
    }

    /**
     * A stored entry with no id cannot be beaconed against, so it is not an
     * Optin — it is a corrupted option, and dropping it is the only thing that
     * leaves the page working.
     */
    public function testAnEntryWithNoIdIsDroppedRatherThanShipped(): void
    {
        $set = PublishedOptin::fromSet([
            ['targeting' => [], 'payload' => ['display_type' => 'popup']],
            ['id' => '01A', 'targeting' => [], 'payload' => ['display_type' => 'popup']],
        ]);

        $this->assertSame(['01A'], array_column(Payload::forRequest($set, self::at('/')), 'id'));
    }

    private static function at(string $path): RequestContext
    {
        return new RequestContext(path: $path);
    }
}
