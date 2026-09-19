<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\TestCase;
use WConvert\Optin\InlinePlacement;

final class InlinePlacementTest extends TestCase
{
    public function test_existing_campaigns_remain_manual_and_automatic_settings_are_closed(): void
    {
        self::assertNull(InlinePlacement::normalize(null));
        self::assertNull(InlinePlacement::normalize(['position' => 'unknown']));
        self::assertSame(['position' => 'after_content'], InlinePlacement::normalize(['position' => 'after_content', 'extra' => 'ignored']));
        self::assertSame(['position' => 'after_paragraph', 'paragraph' => 3, 'fallback' => 'after_content'],
            InlinePlacement::normalize(['position' => 'after_paragraph', 'paragraph' => 3]));
        self::assertNull(InlinePlacement::normalize(['position' => 'after_paragraph', 'paragraph' => -1]));
        self::assertNull(InlinePlacement::normalize(['position' => 'after_paragraph', 'paragraph' => 2.5]));
    }
}
