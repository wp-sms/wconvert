<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\CaptureContract;
use WConvert\Template\HeldReward;

/** Codes and thank-you links arrive with the signup, not the page (ADR 0164). */
#[CoversClass(HeldReward::class)]
final class HeldRewardTest extends TestCase
{
    private const CODE = ['type' => 'code', 'text' => 'FRIDAY25', 'apply_label' => 'Apply', 'apply_href' => '/cart/?coupon=FRIDAY25', 'copy' => true];

    private const SHOP = ['type' => 'followup', 'label' => 'Shop now', 'href' => 'https://example.test/shop'];

    /**
     * Email, then the optional SMS signup, then the thank-you screen.
     *
     * @return array<string, mixed>
     */
    private static function tree(): array
    {
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/journey-email-then-sms.json'), true)['tree'];
        $tree['steps'][2]['content']['children'][] = self::CODE;
        $tree['steps'][2]['content']['children'][] = self::SHOP;

        return $tree;
    }

    /** @param array<string, mixed> $tree */
    private static function json(array $tree): string
    {
        return (string) wp_json_encode($tree, JSON_UNESCAPED_SLASHES);
    }

    public function testACouponSignupKeepsItsWordsAndHoldsItsCodeAndLinks(): void
    {
        $tree = self::tree();
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $tree]], 'grow_email_list', ''));

        $held = HeldReward::printed($tree);

        self::assertStringNotContainsString('FRIDAY25', self::json($held));
        self::assertStringNotContainsString('example.test/shop', self::json($held));
        self::assertStringContainsString('Details received', self::json($held));
        self::assertSame(['hidden' => true, 'type' => 'code', 'apply_label' => 'Apply', 'copy' => true], $held['steps'][2]['content']['children'][2]);
        self::assertSame(['hidden' => true, 'type' => 'followup', 'label' => 'Shop now'], $held['steps'][2]['content']['children'][3]);
        self::assertSame(['received' => [
            ['text' => 'FRIDAY25', 'apply_href' => '/cart/?coupon=FRIDAY25'],
            ['href' => 'https://example.test/shop'],
        ]], HeldReward::of($tree));
    }

    public function testACodeBeforeTheFormStaysInThePage(): void
    {
        $tree = self::tree();
        $tree['steps'][0]['content']['children'][] = array_replace(self::CODE, ['text' => 'WELCOME10']);

        self::assertSame($tree['steps'][0], HeldReward::printed($tree)['steps'][0]);
        self::assertArrayNotHasKey('email', HeldReward::of($tree));
    }

    public function testAnOfferWithNoFormHoldsNothing(): void
    {
        $tree = ['v' => 2, 'submissions' => [], 'steps' => [
            ['id' => 'offer', 'name' => 'Offer', 'kind' => 'content', 'content' => ['type' => 'stack', 'children' => [self::CODE]]],
        ]];

        self::assertSame($tree, HeldReward::printed($tree));
        self::assertSame([], HeldReward::of($tree));
    }

    public function testACodeOnTheOptionalSignupScreenIsHeldToo(): void
    {
        $tree = self::tree();
        array_unshift($tree['steps'][1]['content']['children'], self::CODE);

        self::assertStringNotContainsString('FRIDAY25', self::json(HeldReward::printed($tree)));
        self::assertSame(['text' => 'FRIDAY25', 'apply_href' => '/cart/?coupon=FRIDAY25'], HeldReward::of($tree)['sms'][0]);
    }

    /**
     * Switched off, or inside a switched-off layout: the value leaves the
     * page and is never sent, and its place in the order is kept so the
     * loader still counts the same nodes.
     */
    public function testASwitchedOffCodeIsDroppedAndNeverSent(): void
    {
        $tree = self::tree();
        $tree['steps'][2]['content']['children'][2]['hidden'] = true;
        $tree['steps'][2]['content']['children'][] = ['type' => 'stack', 'hidden' => true, 'children' => [array_replace(self::SHOP, ['href' => 'https://example.test/secret'])]];

        self::assertStringNotContainsString('FRIDAY25', self::json(HeldReward::printed($tree)));
        self::assertStringNotContainsString('secret', self::json(HeldReward::printed($tree)));
        self::assertSame(['received' => [null, ['href' => 'https://example.test/shop'], null]], HeldReward::of($tree));
    }

    public function testAnOptionalFirstSignupHoldsNothingBecauseSkippingReachesTheCode(): void
    {
        $tree = self::tree();
        $tree['submissions'][0]['required'] = false;

        self::assertSame($tree, HeldReward::printed($tree));
        self::assertSame([], HeldReward::of($tree));
    }

    public function testAGraphHoldsOnlyTheScreensEveryRouteReachesThroughTheSignup(): void
    {
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-split-capture.json'), true);
        $tree['steps'][2]['content']['children'][] = array_replace(self::CODE, ['text' => 'BEFORE']);
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $tree]], 'collect_enquiries', ''));

        $held = HeldReward::printed($tree);

        self::assertSame(['hidden' => true, 'type' => 'followup', 'id' => 'n2', 'label' => 'Get the guide'], $held['steps'][0]['content']);
        self::assertSame($tree['steps'][1], $held['steps'][1], 'the submit screen is seen before the signup');
        self::assertSame($tree['steps'][2], $held['steps'][2], 'the entry is seen before the signup');
        self::assertSame(['thanks' => [['href' => 'https://example.test/guide']]], HeldReward::of($tree));
    }

    /** A cached page printed before the code changed is refused, so it is never rewarded by position. */
    public function testChangingAHeldCodeChangesTheCaptureContract(): void
    {
        $tree = self::tree();
        $changed = $tree;
        $changed['steps'][2]['content']['children'][2]['text'] = 'SUMMER10';

        self::assertNotSame(
            CaptureContract::fingerprint(['template' => ['tree' => $tree]], 'grow_email_list', ''),
            CaptureContract::fingerprint(['template' => ['tree' => $changed]], 'grow_email_list', '')
        );
    }
}
