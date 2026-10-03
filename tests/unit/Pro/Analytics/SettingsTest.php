<?php
namespace WConvert\Tests\Unit\Pro\Analytics;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\Analytics\Settings;
use WConvert\Optin\AnalyticsPreference;
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class SettingsTest extends TestCase
{
    public function testDefaultsAndEnvironmentAndCloneGuards(): void
    {
        $settings = new Settings(new FakeOptionStore());
        self::assertFalse($settings->active('https://example.org/', 'production', false));
        $settings->save(['enabled' => true, 'measurement_id' => 'G-TEST123'], 'https://example.org/');
        self::assertTrue($settings->active('https://example.org', 'production', false));
        self::assertFalse($settings->active('https://example.org', 'production', true));
        self::assertFalse($settings->active('https://clone.org', 'production', false));
        self::assertFalse($settings->active('https://example.org', 'staging', false));
        $settings->save(['exclude_managers' => false], 'https://example.org');
        self::assertTrue($settings->active('https://example.org', 'production', true));
    }

    public function testRejectsUnknownSettingsBeforeWriting(): void
    {
        $options = new FakeOptionStore();
        $settings = new Settings($options);
        foreach ([['secret' => 'anything'], ['enabled' => 'true'], ['enabled' => true], ['route' => 'both'], ['consent' => 'none'], ['data_layer' => '__proto__'], ['measurement_id' => 'GTM-1234']] as $invalid) {
            try { $settings->save($invalid, 'https://example.org'); self::fail('Invalid configuration accepted'); }
            catch (\InvalidArgumentException) { self::assertSame(0, $options->writes); }
        }
    }

    public function testCampaignPreferencesAreClosedAndUnicodeSafe(): void
    {
        self::assertSame(['off' => false, 'label' => ''], AnalyticsPreference::normalize(null));
        self::assertSame(['off' => true, 'label' => 'عرض'], AnalyticsPreference::normalize(['off' => true, 'label' => ' عرض ']));
        foreach ([['label' => '<script>'], ['label' => str_repeat('a', 81)], ['off' => 1], ['email' => 'a@b.com']] as $value) {
            try { AnalyticsPreference::normalize($value); self::fail('Invalid preference accepted'); }
            catch (\InvalidArgumentException $error) { self::assertNotSame('', $error->getMessage()); }
        }
    }
}
