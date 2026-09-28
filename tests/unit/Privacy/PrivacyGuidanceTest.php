<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Tests\Unit\Support\FakeOptionStore;

#[CoversClass(PrivacyGuidance::class)]
final class PrivacyGuidanceTest extends TestCase
{
    /** @param array<string, mixed> $tree
     * @return array<string, mixed>|null
     */
    private static function consentIn(array $tree): ?array
    {
        $stack = $tree['steps'] ?? [];

        while ($stack !== []) {
            $node = array_pop($stack);
            if (($node['type'] ?? null) === 'consent') {
                return $node;
            }
            foreach (\WConvert\Template\TemplateTree::childrenOf($node) as $child) {
                if (is_array($child)) {
                    $stack[] = $child;
                }
            }
        }

        return null;
    }

    public function testGuidanceIsOnUntilTheMerchantTurnsItOff(): void
    {
        $options = new FakeOptionStore();
        $guidance = new PrivacyGuidance($options);

        $this->assertTrue($guidance->enabled());

        $guidance->set(false);

        $this->assertFalse($guidance->enabled());
        $this->assertSame(0, $options->get(PrivacyGuidance::OPTION));

        // WordPress may return an empty string for a legacy boolean-false row.
        $options->set(PrivacyGuidance::OPTION, '');
        $this->assertFalse($guidance->enabled());
    }

    public function testTurningGuidanceOffRemovesAutomaticPrivacyCopyOnly(): void
    {
        $options = new FakeOptionStore();
        $guidance = new PrivacyGuidance($options);
        $guidance->set(false);

        $copy = $guidance->copyFor([
            'headline' => 'Ask us anything',
            'consent_text' => [
                'text' => 'Email me updates. %s',
                'link' => ['label' => 'Privacy Policy'],
            ],
            'fine_print' => [
                [
                    'text' => 'We use your details to reply. %s',
                    'link' => ['label' => 'Privacy Policy'],
                ],
                'Sending this request does not book an appointment.',
            ],
        ]);

        $this->assertSame('Ask us anything', $copy['headline']);
        $this->assertArrayNotHasKey('consent_text', $copy);
        $this->assertSame(
            [null, 'Sending this request does not book an appointment.'],
            $copy['fine_print']
        );
    }

    public function testTurningGuidanceOffDropsASinglePolicyNotice(): void
    {
        $options = new FakeOptionStore();
        $guidance = new PrivacyGuidance($options);
        $guidance->set(false);

        $copy = $guidance->copyFor([
            'fine_print' => [
                'text' => 'We use your details to reply. %s',
                'link' => ['label' => 'Privacy Policy'],
            ],
        ]);

        $this->assertArrayNotHasKey('fine_print', $copy);
    }

    public function testTurningGuidanceOffAlsoStripsScopedQuizSignupCopy(): void
    {
        $guidance = new PrivacyGuidance(new FakeOptionStore());
        $guidance->set(false);
        $copy = $guidance->copyFor(['screens' => [
            'screen:result' => ['next_label' => 'Continue'],
            'submission:email' => ['consent_text' => ['text' => 'Email me news.'], 'cta_label' => 'Sign up'],
        ]]);

        $this->assertSame('Continue', $copy['screens']['screen:result']['next_label']);
        $this->assertArrayNotHasKey('consent_text', $copy['screens']['submission:email']);
        $this->assertSame('Sign up', $copy['screens']['submission:email']['cta_label']);
    }

    public function testOngoingMarketingShowsConsentButOneTimeRequestsDoNot(): void
    {
        $guidance = new PrivacyGuidance(new FakeOptionStore());
        $tree = \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'stack',
            'children' => [[
                'type' => 'consent',
                'role' => 'consent_text',
                'hidden' => true,
                'text' => 'Send me weekly news.',
            ]],
        ]]]);

        $marketing = self::consentIn($guidance->treeFor($tree, Goal::GrowEmailList));
        $request = self::consentIn($guidance->treeFor($tree, Goal::CollectEnquiries));
        $download = self::consentIn($guidance->treeFor($tree, Goal::DeliverLeadMagnet));
        $optionalQuizSignup = self::consentIn($guidance->treeFor($tree, Goal::FindMatch));

        $this->assertFalse($marketing['hidden'] ?? true);
        $this->assertTrue($request['hidden'] ?? false);
        $this->assertTrue($download['hidden'] ?? false);
        $this->assertFalse($optionalQuizSignup['hidden'] ?? true);
    }

    public function testMarketingNeverRevealsABlankConsentControl(): void
    {
        $guidance = new PrivacyGuidance(new FakeOptionStore());
        $tree = \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'consent', 'role' => 'consent_text', 'hidden' => true]]]);

        $consent = self::consentIn($guidance->treeFor($tree, Goal::GrowSmsList));

        $this->assertTrue($consent['hidden'] ?? false);
    }

    public function testTurningGuidanceOffLeavesMerchantVisibilityAlone(): void
    {
        $guidance = new PrivacyGuidance(new FakeOptionStore());
        $guidance->set(false);
        $tree = \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'consent',
            'role' => 'consent_text',
            'hidden' => false,
            'text' => 'Keep this choice.',
        ]]]);

        $this->assertSame($tree, $guidance->treeFor($tree, Goal::CollectEnquiries));
    }
}
