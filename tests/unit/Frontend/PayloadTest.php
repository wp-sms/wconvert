<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\Payload;
use WConvert\Frontend\PayloadTag;
use WConvert\Targeting\RequestContext;

/**
 * What the page actually receives: the published set, filtered to this
 * request, with the server-evaluated axis stripped rather than shipped
 * (ADR 0003, ADR 0005).
 */
#[CoversClass(Payload::class)]
#[CoversClass(PayloadTag::class)]
final class PayloadTest extends TestCase
{
    /**
     * @param array<string, mixed> $targeting
     * @return array<string, mixed>
     */
    private static function projection(string $id, array $targeting): array
    {
        return ['id' => $id, 'targeting' => $targeting, 'payload' => ['display_type' => 'popup']];
    }

    public function testAnOptinTargetedAtOnePageIsPresentThereAndAbsentEverywhereElse(): void
    {
        $set = [self::projection('01A', ['include' => [['type' => 'post', 'value' => 12]]])];

        $onTarget = new RequestContext(path: '/hello/', isSingular: true, postId: 12, postType: 'post');
        $elsewhere = new RequestContext(path: '/other/', isSingular: true, postId: 13, postType: 'post');

        $this->assertSame(['01A'], array_column(Payload::forRequest($set, $onTarget), 'id'));
        $this->assertSame([], Payload::forRequest($set, $elsewhere));
    }

    public function testTargetingIsStrippedFromWhatTheBrowserReceives(): void
    {
        $set = [self::projection('01A', ['include' => [['type' => 'url', 'value' => '/secret-staging-path']]])];
        $context = new RequestContext(path: '/secret-staging-path/');

        $entries = Payload::forRequest($set, $context);

        $this->assertSame([['id' => '01A', 'display_type' => 'popup']], $entries);
        $this->assertStringNotContainsString('secret-staging-path', PayloadTag::render($entries));
    }

    /**
     * `<script type="application/json">` and nothing else. Every JS optimizer
     * tested selects on `script[!type]` or `type="text/javascript"`, so this
     * tag is invisible to all of them and survives aggregation in place
     * (ADR 0004).
     */
    public function testThePayloadTravelsAsAJsonScriptTag(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_type' => 'popup']]);

        $this->assertStringStartsWith('<script type="application/json" id="wconvert-payload">', $tag);
        $this->assertStringEndsWith('</script>', $tag);
        $this->assertStringContainsString('"01A"', $tag);
    }

    /**
     * A closing tag inside the copy must not end the script element early.
     * json_encode's JSON_HEX_TAG is what stops it, and this is the test that
     * notices the day someone drops the flag for smaller output.
     */
    public function testCopyContainingAClosingScriptTagCannotBreakOut(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'headline' => '</script><script>alert(1)</script>']]);

        $this->assertSame(1, substr_count($tag, '</script>'));
        $this->assertStringNotContainsString('<script>alert', $tag);
    }

    /**
     * No matching Optin means no tag — not an empty one. An Optin that does
     * not match the current page costs the page nothing (ADR 0003).
     */
    public function testNoMatchingOptinPrintsNothingAtAll(): void
    {
        $this->assertSame('', PayloadTag::render([]));
    }
}
