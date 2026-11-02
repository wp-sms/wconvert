<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\PageLabels;
use WConvert\Pro\Frontend\ProPageLabels;
use WConvert\Template\DesignWords;

/**
 * The renderer's own words, translated in PHP and read in TypeScript BY
 * POSITION — so the one thing that must not happen is the two lists drifting.
 *
 * `pageLabel(7, 'Email address')` renders the English at the call site where
 * nothing is printed and position 7 of `data-labels` where something is. A
 * reordering on either side would put "Phone number" on the email field of
 * every translated site, with every other test green, so each call in the
 * shipped TypeScript is read here and held to the English at its position.
 */
#[CoversClass(PageLabels::class)]
#[CoversClass(ProPageLabels::class)]
final class PageLabelsTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestFilters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestFilters'] = [];
    }

    /** @return array<int, string> Position => English, free's and Pro's. */
    private static function english(): array
    {
        $english = PageLabels::ENGLISH;

        foreach (ProPageLabels::ENGLISH as $offset => $word) {
            $english[ProPageLabels::FIRST + $offset] = $word;
        }

        return $english;
    }

    /** @return list<array{file: string, index: int, english: string}> */
    private static function calls(): array
    {
        $calls = [];
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(self::ROOT, \FilesystemIterator::SKIP_DOTS));

        foreach ($files as $file) {
            $path = str_replace('\\', '/', substr((string) $file, strlen(self::ROOT)));
            if (!preg_match('#^(resources|pro/modules|pro/resources)/.+\.tsx?$#', $path) || str_contains($path, '.test.')) {
                continue;
            }

            preg_match_all("/pageLabel\\((\\d+), '((?:[^'\\\\]|\\\\.)*)'\\)/", (string) file_get_contents((string) $file), $found, PREG_SET_ORDER);
            foreach ($found as [, $index, $english]) {
                $calls[] = ['file' => $path, 'index' => (int) $index, 'english' => stripcslashes($english)];
            }
        }

        return $calls;
    }

    public function testEveryCallInTheTypeScriptNamesTheWordAtItsPosition(): void
    {
        $calls = self::calls();
        $english = self::english();

        $this->assertGreaterThanOrEqual(20, count($calls), 'the scan found too few calls to mean anything');

        foreach ($calls as $call) {
            $this->assertSame(
                $english[$call['index']] ?? null,
                $call['english'],
                "{$call['file']} reads position {$call['index']} as \"{$call['english']}\""
            );
        }
    }

    public function testEveryPositionIsReadSomewhere(): void
    {
        $read = array_unique(array_column(self::calls(), 'index'));

        foreach (array_keys(self::english()) as $index) {
            $this->assertContains($index, $read, "position {$index} is translated and never read");
        }
    }

    public function testTheTranslatedListsAreTheEnglishOnesInTheSameOrder(): void
    {
        // The suite's __() and _x() hand the English back, so this is the
        // order test: a translated list one entry short or shifted fails here.
        $this->assertSame(PageLabels::ENGLISH, PageLabels::translated());
        $this->assertSame(ProPageLabels::ENGLISH, ProPageLabels::translated());
    }

    public function testAnUntranslatedSitePrintsNothing(): void
    {
        ProPageLabels::hooks();

        $this->assertSame([], PageLabels::differing());
        $this->assertNull(PageLabels::attribute());
    }

    /**
     * Only the words that differ are printed, keyed by position, as an object
     * — `JSON_FORCE_OBJECT`, because a map holding only position 0 would
     * otherwise encode as a list, and one holding 0 and 101 as an object, and
     * the reader would have to handle both shapes for nothing.
     */
    public function testATranslatedWordIsPrintedAtItsPositionAsAnObject(): void
    {
        add_filter('wconvert_page_labels', static fn (array $labels): array => [0 => 'Schließen', 101 => 'Produkte werden geladen…'] + $labels);

        $this->assertSame('{"0":"Schließen","101":"Produkte werden geladen…"}', PageLabels::attribute());
    }

    public function testASiteInALanguageReadsItsLabelFileWhereWordPressLeftEnglish(): void
    {
        $GLOBALS['wconvertTestLocale'] = 'de_DE';

        try {
            $labels = PageLabels::differing();
        } finally {
            unset($GLOBALS['wconvertTestLocale']);
        }

        $this->assertSame('Weiter', $labels[array_search('Continue', PageLabels::ENGLISH, true)]);
        $this->assertSame('Schließen', $labels[0]);
        $this->assertSame(array_keys(array_filter(PageLabels::ENGLISH, static fn (string $word): bool => $word !== 'Name')), array_keys($labels), 'in English\'s order, every position but the word German spells the same');
    }

    public function testALanguagePacksWordStaysAsThePackHasIt(): void
    {
        $GLOBALS['wconvertTestLocale'] = 'de_DE';
        $GLOBALS['wconvertTestTranslations']['Close'] = 'Zumachen';

        try {
            $labels = PageLabels::differing();
        } finally {
            unset($GLOBALS['wconvertTestLocale'], $GLOBALS['wconvertTestTranslations']['Close']);
        }

        $this->assertSame('Zumachen', $labels[0]);
    }

    public function testASiteInEnglishTouchesNoFile(): void
    {
        $this->assertSame([], DesignWords::labelsFor(WCONVERT_DIR, 'en_US'));
        $this->assertSame([], DesignWords::labelsFor(WCONVERT_DIR, 'en_GB'));
        $this->assertSame([], DesignWords::labelsFor('/nowhere', 'de_DE'));
    }

    public function testProsLabelsReadProsFile(): void
    {
        $GLOBALS['wconvertTestLocale'] = 'de_DE';

        try {
            $labels = ProPageLabels::add([]);
        } finally {
            unset($GLOBALS['wconvertTestLocale']);
        }

        $this->assertSame('%s ansehen', $labels[ProPageLabels::FIRST + array_search('View %s', ProPageLabels::ENGLISH, true)]);
    }

    public function testALabelFileIsSmallAndHoldsOnlyLabels(): void
    {
        foreach (glob(dirname(__DIR__, 3) . '/resources/templates/words/labels/*.json') ?: [] as $file) {
            $this->assertLessThan(4096, filesize($file), basename($file) . ' is read on every visitor page');
            $this->assertEmpty(array_diff(array_keys((array) json_decode((string) file_get_contents($file), true)), PageLabels::ENGLISH));
        }
    }
}
