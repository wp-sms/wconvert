<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Tests\Unit\Support\FakeOptionStore;

#[CoversClass(PrivacyGuidance::class)]
final class PrivacyGuidanceTest extends TestCase
{
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
}
