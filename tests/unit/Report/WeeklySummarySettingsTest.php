<?php

namespace WConvert\Tests\Unit\Report;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Report\WeeklySummarySettings;
use WConvert\Tests\Unit\Support\FakeOptionStore;

#[CoversClass(WeeklySummarySettings::class)]
final class WeeklySummarySettingsTest extends TestCase
{
    public function testItIsOnByDefaultAndGoesToTheAdminEmail(): void
    {
        $options = new FakeOptionStore();
        $options->set('admin_email', 'owner@example.com');
        $settings = new WeeklySummarySettings($options);

        $this->assertTrue($settings->enabled());
        $this->assertSame([], $settings->chosen());
        $this->assertSame(['owner@example.com'], $settings->recipients());
    }

    public function testTheDefaultFollowsTheAdminEmailWhenItChanges(): void
    {
        $options = new FakeOptionStore();
        $options->set('admin_email', 'owner@example.com');
        $settings = new WeeklySummarySettings($options);
        $settings->save(true, ['Owner@example.com']);

        $options->set('admin_email', 'new-owner@example.com');

        $this->assertSame([], $settings->chosen(), 'Saving the default spelled out stores nothing.');
        $this->assertSame(['new-owner@example.com'], $settings->recipients());
    }

    public function testOffAndOtherRecipientsSurviveARoundTrip(): void
    {
        $options = new FakeOptionStore();
        $options->set('admin_email', 'owner@example.com');
        $settings = new WeeklySummarySettings($options);
        $settings->save(false, ['a@example.com', 'b@example.com']);

        $this->assertFalse($settings->enabled());
        $this->assertSame(['a@example.com', 'b@example.com'], $settings->recipients());
        $this->assertSame(0, $options->get(WeeklySummarySettings::OPTION)['enabled'], 'An integer, because WordPress stores false as an empty string.');
    }

    public function testParseSplitsOnCommasAndSpacesAndNamesTheBadOnes(): void
    {
        $parsed = WeeklySummarySettings::parse(" a@example.com, A@example.com;b@example.com\nnot-an-email ", static fn (string $a): bool => str_contains($a, '@'));

        $this->assertSame(['a@example.com', 'b@example.com'], $parsed['valid']);
        $this->assertSame(['not-an-email'], $parsed['invalid']);
    }
}
