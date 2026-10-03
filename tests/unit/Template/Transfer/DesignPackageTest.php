<?php
namespace WConvert\Tests\Unit\Template\Transfer;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Transfer\DesignPackage;
use WConvert\Template\Catalog\PackValidator;

final class DesignPackageTest extends TestCase
{
    public function testMerchantLinksAndVisibleConsentSurviveWhileUnsafeLinksAreRefused(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $design['tree']['steps'][0]['content']['children'][] = ['type' => 'text', 'id' => 'n990', 'text' => 'Policy', 'link' => ['label' => 'Read', 'href' => 'https://shop.example/policy']];
        $validator = PackValidator::shipping();
        $result = $validator->portable($design);
        self::assertStringContainsString('shop.example/policy', json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $design['tree']['steps'][0]['content']['children'][count($design['tree']['steps'][0]['content']['children']) - 1]['link']['href'] = 'javascript:alert(1)';
        $this->expectException(\RuntimeException::class);
        $validator->portable($design);
    }

    public function testGraphJourneyRoundTripsOnPaidInstallWithoutLosingConnections(): void
    {
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-split-capture.json'), true);
        $tree = \WConvert\Template\TemplateVocabulary::fromManifest()->normalize(['tree' => $tree])['tree'];
        $validator = new PackValidator(\WConvert\Template\TemplateManifest::load(), \WConvert\Template\TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Pro);
        $design = $validator->portable(['name' => 'Journey', 'display_type' => 'popup', 'tree' => $tree, 'tokens' => []]);
        self::assertSame(3, $design['tree']['v']);
        self::assertSame($tree['graph'] ?? null, $design['tree']['graph']);
        $this->expectException(\RuntimeException::class);
        PackValidator::shipping()->portable($design);
    }

    public function testTwoSubmissionsAndVisibleConsentSurviveGraphImport(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/journey-email-then-sms.json'), true);
        $design['tree']['v'] = 3;
        $design['tree']['graph'] = ['entry' => 'email', 'edges' => [
            ['id' => 'first', 'from' => 'email', 'to' => 'sms', 'kind' => 'default'],
            ['id' => 'last', 'from' => 'sms', 'to' => 'received', 'kind' => 'default'],
        ]];
        $validator = new PackValidator(\WConvert\Template\TemplateManifest::load(), \WConvert\Template\TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Pro);
        $result = $validator->portable($design);
        self::assertCount(2, $result['tree']['submissions']);
        self::assertSame($design['tree']['submissions'], $result['tree']['submissions']);
    }

    #[\PHPUnit\Framework\Attributes\TestWith(['schema'])]
    #[\PHPUnit\Framework\Attributes\TestWith(['node'])]
    #[\PHPUnit\Framework\Attributes\TestWith(['css'])]
    #[\PHPUnit\Framework\Attributes\TestWith(['size'])]
    public function testInvalidDocumentCannotEnterThePreview(string $case): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $package = new DesignPackage(PackValidator::shipping());
        $path = tempnam(sys_get_temp_dir(), 'wc-invalid-');
        try {
            $package->write($path, $design, fn () => null);
            $zip = new \ZipArchive(); $zip->open($path);
            $json = $zip->getFromName('design.json');
            self::assertIsString($json);
            $doc = json_decode($json, true);
            if ($case === 'schema') $doc['schema'] = 999;
            if ($case === 'node') $doc['design']['tree']['steps'][0]['content']['children'][] = ['type' => 'html', 'html' => '<script>alert(1)</script>'];
            if ($case === 'css') $doc['design']['tokens']['bg'] = 'url(https://tracker.example/pixel)';
            $zip->addFromString('design.json', $case === 'size' ? str_repeat(' ', PackValidator::MAX_BYTES + 1) : json_encode($doc, JSON_THROW_ON_ERROR));
            $zip->close();
            $this->expectException(\RuntimeException::class);
            $package->read($path);
        } finally { unlink($path); }
    }

    public function testAnEmptyFollowupDoesNotHideBrokenSubmissionReferences(): void
    {
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-split-capture.json'), true);
        $tree = \WConvert\Template\TemplateVocabulary::fromManifest()->normalize(['tree' => $tree])['tree'];
        $tree['steps'][0]['content']['href'] = '';
        $tree['submissions'][0]['fields'] = ['missing'];
        $validator = new PackValidator(\WConvert\Template\TemplateManifest::load(), \WConvert\Template\TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Pro);
        $this->expectException(\RuntimeException::class);
        $validator->portable(['name' => 'Broken', 'display_type' => 'popup', 'tree' => $tree, 'tokens' => []]);
    }

    public function testArchiveRejectsUnexpectedPathsBeforeReadingTheirContents(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'wc-zip-');
        $zip = new \ZipArchive(); $zip->open($path, \ZipArchive::OVERWRITE); $zip->addFromString('../outside.php', '<?php echo 1;'); $zip->close();
        try {
            $this->expectException(\RuntimeException::class);
            (new DesignPackage(PackValidator::shipping()))->read($path);
        } finally { unlink($path); }
    }

    public function testMissingImageNeedsExplicitOmissionAndNeverMutatesTheDraft(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $design['tokens']['bg-image'] = 'url("https://missing.example/a.png")';
        $package = new DesignPackage(PackValidator::shipping());
        $path = tempnam(sys_get_temp_dir(), 'wc-zip-');
        try {
            try { $package->write($path, $design, fn () => null); self::fail('Missing image was silently omitted'); }
            catch (\WConvert\Template\Transfer\TransferProblems $e) { self::assertArrayHasKey('tokens/bg-image', $e->problems); }
            $package->write($path, $design, fn () => null, ['tokens/bg-image']);
            $result = $package->read($path);
            self::assertSame('none', $result['design']['tokens']['bg-image']);
            self::assertNotEmpty($result['notes']);
            self::assertStringContainsString('missing.example', $design['tokens']['bg-image']);
        } finally { unlink($path); }
    }

    public function testImagesAndBackgroundsTravelOnceWithIndependentAltText(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $design['tokens']['bg-image'] = 'url("https://old.example/photo.png")';
        $design['tree']['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n900', 'src' => 'https://old.example/photo.png', 'alt' => 'Product'];
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=');
        $package = new DesignPackage(PackValidator::shipping());
        $path = tempnam(sys_get_temp_dir(), 'wc-test-');
        try {
            $package->write($path, $design, fn (string $url) => $png);
            $read = $package->read($path);
            self::assertCount(1, $read['assets']);
            self::assertCount(2, $read['bindings']);
            self::assertSame($png, $package->image($path, $read['assets'][0]));
            self::assertSame('Product', $read['design']['tree']['steps'][0]['content']['children'][count($design['tree']['steps'][0]['content']['children']) - 1]['alt']);
        } finally { unlink($path); }
    }

    public function testCurrentDesignRoundTripsWithoutCampaignData(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $design['destinations'] = ['secret-connection'];
        $design['tokens']['bg'] = '#123456';
        $package = new DesignPackage(PackValidator::shipping());
        $path = tempnam(sys_get_temp_dir(), 'wc-test-');
        try {
            $package->write($path, $design, fn (string $url) => null);
            $read = $package->read($path);
            self::assertSame('#123456', $read['design']['tokens']['bg']);
            self::assertSame($design['tree']['steps'][0]['name'], $read['design']['tree']['steps'][0]['name']);
            self::assertArrayNotHasKey('destinations', $read['design']);
            self::assertArrayNotHasKey('id', $read['design']);
            self::assertSame([], $read['assets']);
        } finally { unlink($path); }
    }
}
