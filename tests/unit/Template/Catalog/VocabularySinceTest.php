<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\VocabularySince;

/** A vocabulary entry without a stamp cannot ship (ADR 0156). */
final class VocabularySinceTest extends TestCase
{
    public function testEveryManifestEntryIsStamped(): void
    {
        self::assertSame([], VocabularySince::load()->missing(), 'Run `php bin/stamp-template-since.php` after changing the template manifest.');
    }

    public function testEveryStampIsAReleaseThisPluginCanReach(): void
    {
        $stamps = json_decode((string) file_get_contents(WCONVERT_DIR . VocabularySince::PATH), true, 8, JSON_THROW_ON_ERROR);
        unset($stamps['_note']);
        foreach ($stamps + VocabularySince::CAPABILITIES as $key => $since) {
            self::assertTrue(PackValidator::version($since), $key);
            self::assertTrue(version_compare($since, WCONVERT_VERSION, '<='), $key . ' is stamped with an unreleased version');
        }
    }

    public function testEveryCapabilityTheReaderKnowsIsStamped(): void
    {
        self::assertEqualsCanonicalizing(PackValidator::CAPABILITIES, array_keys(VocabularySince::CAPABILITIES));
    }

    public function testRequirementIsTheNewestStampTheDesignUses(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . 'resources/templates/library/reading-slip.json'), true, 64, JSON_THROW_ON_ERROR);
        $manifest = json_decode((string) file_get_contents(WCONVERT_DIR . 'resources/templates/manifest.json'), true, 64, JSON_THROW_ON_ERROR);
        $base = new VocabularySince($manifest, array_fill_keys((new VocabularySince($manifest, []))->entries(), '1.0.0'));
        self::assertSame('1.0.0', $base->requiredBy($design, ['template-tree:2']));

        $stamps = array_fill_keys((new VocabularySince($manifest, []))->entries(), '1.0.0');
        $stamps['node:heading'] = '1.4.0';
        self::assertSame('1.4.0', (new VocabularySince($manifest, $stamps))->requiredBy($design, ['template-tree:2']));
        $stamps['node:heading'] = '1.0.0';
        $stamps['token:radius'] = '1.2.0';
        self::assertSame('1.2.0', (new VocabularySince($manifest, $stamps))->requiredBy($design, []), 'A design-level token counts');
    }

    public function testAnUnknownCapabilityIsABuildError(): void
    {
        $this->expectException(\RuntimeException::class);
        VocabularySince::load()->requiredBy(['tree' => ['steps' => []], 'tokens' => []], ['teleport:1']);
    }
}
