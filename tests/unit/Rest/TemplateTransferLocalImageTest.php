<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Rest\TemplateTransferController;

/**
 * Export reads a draft's pictures from this site. An unsaved draft still names
 * a bundled photo by its plugin URL (ADR 0172), Pro's included, and its bytes
 * must reach the ZIP.
 */
final class TemplateTransferLocalImageTest extends TestCase
{
    public function testABundledPhotoIsReadFromItsArtworkFileFreeAndPro(): void
    {
        foreach ([[WCONVERT_URL, WCONVERT_DIR], [WCONVERT_PRO_URL, WCONVERT_PRO_DIR]] as [$url, $dir]) {
            $files = glob($dir . 'resources/template-artwork/*.webp') ?: [];
            self::assertNotSame([], $files);
            $name = basename($files[0]);
            self::assertSame(file_get_contents($files[0]), TemplateTransferController::localImage(rtrim($url, '/') . '/resources/template-artwork/' . $name));
        }
    }

    public function testANameNoFileAnswersIsNotAPicture(): void
    {
        self::assertNull(TemplateTransferController::localImage(rtrim(WCONVERT_PRO_URL, '/') . '/resources/template-artwork/' . hash('sha256', 'gone') . '.webp'));
    }
}
