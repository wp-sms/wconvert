<?php

namespace WConvert\Tests\Unit\Assets;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Assets\ViteHelper;

/**
 * Free's admin catalogue, read by FREE's file names onto another handle.
 *
 * A language pack names each JSON catalogue after the md5 of the shipped
 * file's path, and Pro's bundle is a different file from free's. So the only
 * catalogues that hold free's strings on a Pro install are the ones keyed by
 * free's own `main-*.js` and `builder-*.js`, and this is what reads them.
 */
#[CoversClass(ViteHelper::class)]
final class ViteHelperTest extends TestCase
{
    private const FREE_TREE = __DIR__ . '/../../fixtures/admin-replacement/free/';

    private const FREE_URL = 'https://example.test/wp-content/plugins/wconvert/';

    private const HANDLE = 'some-other-admin';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestScripts'] = ['registered' => [], 'enqueued' => []];
        $GLOBALS['wconvertTestInlineScripts'] = [];
        $GLOBALS['wconvertTestScriptCatalogues'] = [];
    }

    private static function catalogue(string $msgid, string $msgstr): string
    {
        return (string) json_encode(['locale_data' => ['messages' => [
            '' => ['domain' => 'messages'],
            $msgid => [$msgstr],
        ]]]);
    }

    /** @return list<string> */
    private static function inlined(): array
    {
        return array_column($GLOBALS['wconvertTestInlineScripts'][self::HANDLE] ?? [], 'data');
    }

    public function testEveryOneOfFreesBuiltFilesBringsItsCatalogueIntoFreesDomain(): void
    {
        $GLOBALS['wconvertTestScriptCatalogues'][self::HANDLE . '-wconvert-main-1234abcd|wconvert'] =
            self::catalogue('Campaigns', 'Kampagnen');
        $GLOBALS['wconvertTestScriptCatalogues'][self::HANDLE . '-wconvert-builder-5678efgh|wconvert'] =
            self::catalogue('Close button', 'Knopf zum Schliessen');

        ViteHelper::inlineAdminTranslations(self::HANDLE, self::FREE_TREE, self::FREE_URL);

        $inlined = implode("\n", self::inlined());
        $this->assertStringContainsString('Kampagnen', $inlined, 'the entry\'s strings were not loaded');
        $this->assertStringContainsString('Knopf zum Schliessen', $inlined, 'the builder chunk\'s strings were not loaded');

        foreach (self::inlined() as $script) {
            $this->assertStringEndsWith('"wconvert" );', $script);
            // The catalogue's own header named another domain; setLocaleData
            // must be told the one it is merged into.
            $this->assertStringContainsString('"domain":"wconvert"', $script);
        }
    }

    /**
     * Registered so `load_script_textdomain()` can resolve each file's REAL
     * path — free's, under free's URL, since that path is what the md5 in the
     * catalogue's name was taken of — and never enqueued, so no second copy
     * of free's admin runs.
     */
    public function testFreesFilesAreRegisteredAtFreesOwnUrlsAndNeverEnqueued(): void
    {
        ViteHelper::inlineAdminTranslations(self::HANDLE, self::FREE_TREE, self::FREE_URL);

        $registered = $GLOBALS['wconvertTestScripts']['registered'];
        $this->assertSame(
            self::FREE_URL . 'public/admin/main-1234abcd.js',
            $registered[self::HANDLE . '-wconvert-main-1234abcd']['src'] ?? null
        );
        $this->assertSame(
            self::FREE_URL . 'public/admin/builder-5678efgh.js',
            $registered[self::HANDLE . '-wconvert-builder-5678efgh']['src'] ?? null
        );
        $this->assertSame([], $GLOBALS['wconvertTestScripts']['enqueued']);
    }

    public function testAnUntranslatedLocaleAddsNothing(): void
    {
        ViteHelper::inlineAdminTranslations(self::HANDLE, self::FREE_TREE, self::FREE_URL);

        $this->assertSame([], self::inlined());
    }
}
