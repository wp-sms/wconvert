<?php
namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\TestCase;
use WConvert\Optin\ContentLock;

final class ContentLockTest extends TestCase
{
    public function testOnlyAnExplicitHideModeCanEnableLocking(): void
    {
        self::assertNull(ContentLock::normalize(true));
        self::assertNull(ContentLock::normalize(['mode' => 'blur']));
        self::assertSame(['mode' => 'hide'], ContentLock::normalize(['mode' => 'hide', 'selector' => 'body']));
    }
}
