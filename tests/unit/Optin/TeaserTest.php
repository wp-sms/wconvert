<?php
namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\TestCase;
use WConvert\Optin\Teaser;

final class TeaserTest extends TestCase
{
    public function testDefaultsAndUnknownKeysDoNotShip(): void
    {
        self::assertSame(['label' => 'Save 10%'], Teaser::normalize('popup', ['label' => ' Save 10% ', 'gap' => 16, 'placement' => 'block_end_inline_end', 'mobile' => ['visible' => true], 'html' => '<b>bad</b>']));
        self::assertNull(Teaser::normalize('inline', ['label' => 'Save']));
        self::assertNull(Teaser::normalize('popup', null));
    }

    public function testUnicodeLabelAndBoundedOverrides(): void
    {
        self::assertSame(['label' => str_repeat('🎉', 80), 'gap' => 96, 'mobile' => ['visible' => false, 'gap' => 8]], Teaser::normalize('slide_in', ['label' => str_repeat('🎉', 80), 'gap' => 900, 'mobile' => ['visible' => false, 'gap' => 1]]));
        $this->expectException(\InvalidArgumentException::class);
        Teaser::normalize('popup', ['label' => str_repeat('🎉', 81)]);
    }

    public function testEmptyLabelCannotEnableReminder(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        Teaser::normalize('popup', ['label' => '   ']);
    }
}
