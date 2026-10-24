<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Frontend\PayloadTag;
use WConvert\Template\BundledFonts;
use WConvert\Template\GoogleFonts;

final class BundledFontsTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestOptionTable'][GoogleFonts::OPTION]);
    }

    public function testFontFilesAndLicensesShipOutsideExcludedTools(): void
    {
        $root = dirname(__DIR__, 3) . '/resources/template-fonts/';
        $css = BundledFonts::styleTag(BundledFonts::families());
        preg_match_all('/template-fonts\/([^"\)]+\.woff2)/', $css, $matches);
        $this->assertCount(4, $matches[1]);
        foreach ($matches[1] as $file) {
            $this->assertFileExists($root . $file);
            $this->assertSame('wOF2', substr((string) file_get_contents($root . $file), 0, 4));
        }
        foreach (['dmsans', 'bebasneue', 'cormorantgaramond'] as $family) {
            $this->assertStringContainsString('SIL OPEN FONT LICENSE', (string) file_get_contents($root . $family . '-OFL.txt'));
        }
        $this->assertStringContainsString('font-style:italic', $css);
        $this->assertStringNotContainsString('data:', $css);
    }

    public function testLocalFacesAreDocumentLevelWithRemotePermissionOffAndNeverEscalatePermission(): void
    {
        GoogleFonts::set(false);
        $fonts = [
            ['family' => 'Bebas Neue', 'faces' => [['weight' => 400, 'italic' => false]]],
            ['family' => 'Creepster', 'faces' => [['weight' => 400, 'italic' => false]]],
        ];
        $entries = [['id' => '01A', 'template' => ['tokens' => ['heading-font' => "'Bebas Neue', sans-serif"], 'tree' => ['fonts' => $fonts, 'steps' => []]]]];
        $off = PayloadTag::render($entries, '', '', null, 'UTC');
        $this->assertStringStartsWith('<style data-wc-bundled-fonts>', $off);
        $this->assertStringContainsString('bebas-neue.woff2', $off);
        $this->assertStringNotContainsString('dm-sans.woff2', $off);
        $this->assertStringNotContainsString('data-google-fonts', $off);
        $this->assertStringNotContainsString('fonts.googleapis.com', $off);
        $this->assertFalse(GoogleFonts::enabled());

        GoogleFonts::set(true);
        $on = PayloadTag::render($entries, '', '', null, 'UTC');
        if (preg_match('/<script[^>]*>(.*)<\/script>/s', $on, $json) !== 1) {
            $this->fail('Visitor payload script was missing.');
        }
        $this->assertSame([$fonts[1]], json_decode($json[1], true)[0]['template']['tree']['fonts']);
    }

    public function testUnbundledOrMaliciousFamilyNamesProduceNoLocalMarkup(): void
    {
        $this->assertSame('', BundledFonts::styleTag(['Inter', '"><script>alert(1)</script>']));
        $this->assertSame('', PayloadTag::render([], '', '', null, 'UTC'));
    }
}
