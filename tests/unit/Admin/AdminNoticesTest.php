<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\AdminNotices;
use WConvert\Optin\PublishedSet;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * A notice can end with the guide that fixes it (ADR 0145).
 */
#[CoversClass(AdminNotices::class)]
final class AdminNoticesTest extends TestCase
{
    public function testANoticeEndsWithItsGuideInANewTab(): void
    {
        $notices = new AdminNotices(new PublishedSet(new FakeOptionStore()));
        $notices->add('Something is missing.', ['url' => 'https://wconvert.io/docs/update-wconvert/#update-the-files', 'label' => 'How to reinstall']);
        $notices->add('Plain.');

        ob_start();
        $notices->render();
        $html = (string) ob_get_clean();

        $this->assertStringContainsString('Something is missing. <a href="https://wconvert.io/docs/update-wconvert/#update-the-files" target="_blank" rel="noreferrer">How to reinstall', $html);
        $this->assertSame(1, substr_count($html, '<a '), 'a notice without a guide has no link');
    }
}
