<?php

namespace WConvert\Tests\Unit\Pro\Template;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Pro\Template\ProPlaybooks;
use WConvert\Pro\Template\ProTemplates;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\BundledTemplates;
use WConvert\Template\DesignBudget;
use WConvert\Template\DesignWords;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * Every language Pro ships, composed the way `ProServiceProvider` composes it,
 * held to what `ShippedDesignWordsTest` holds Free's to.
 */
#[CoversNothing]
final class ShippedProDesignWordsTest extends TestCase
{
    private const FREE_DIR = __DIR__ . '/../../../..';
    private const PRO_DIR = self::FREE_DIR . '/pro';

    /** @return iterable<string, array{string}> */
    public static function locales(): iterable
    {
        foreach (glob(self::PRO_DIR . '/' . DesignWords::PATH . '/*.json') ?: [] as $file) {
            yield basename($file, '.json') => [basename($file, '.json')];
        }
    }

    private static function library(?string $locale): TemplateLibrary
    {
        return TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR, $locale === null ? new DesignWords() : DesignWords::bundled(self::FREE_DIR, $locale)),
            new ProTemplates(self::PRO_DIR, $locale === null ? new DesignWords() : DesignWords::bundled(self::PRO_DIR, $locale)),
        );
    }

    private static function bytes(TemplateLibrary $library, string $id): int
    {
        return strlen((string) gzencode((string) json_encode($library->snapshotInto(['template_id' => $id])['template'] ?? []), 9));
    }

    /**
     * The per-design cap has never bound Pro's journeys (`LibraryLintTest` holds
     * Free and hosted to it), so a design already over it in English is not held
     * to it here either. A language must not push one over that English fits.
     */
    #[DataProvider('locales')]
    public function testEveryDesignStillRegistersAndNoLanguagePushesOneOverItsBudget(string $locale): void
    {
        $english = self::library(null);
        $translated = self::library($locale);

        $this->assertSame(array_keys($english->all()), array_keys($translated->all()));

        $over = [];
        foreach (array_keys($translated->all()) as $id) {
            $bytes = self::bytes($translated, (string) $id);
            if ($bytes > DesignBudget::PER_DESIGN && self::bytes($english, (string) $id) <= DesignBudget::PER_DESIGN) $over[$id] = $bytes;
        }

        $this->assertSame([], $over, 'gzipped bytes against a ' . DesignBudget::PER_DESIGN . ' B cap in ' . $locale);
    }

    #[DataProvider('locales')]
    public function testEverySetupStillRegisters(string $locale): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::FREE_DIR);
        $rules = RuleVocabulary::fromManifest(self::FREE_DIR);
        $words = DesignWords::bundled(self::FREE_DIR, $locale);
        $library = PlaybookLibrary::fromDirectory(self::library($locale), $vocabulary, $rules, self::FREE_DIR, (new ProPlaybooks(self::PRO_DIR, DesignWords::bundled(self::PRO_DIR, $locale)))->entries(), $words);

        $this->assertSame([], $library->rejections());
    }

    #[DataProvider('locales')]
    public function testAStartingWordIsTranslatedAndWhatARuleReadsIsNot(string $locale): void
    {
        $words = DesignWords::bundled(self::PRO_DIR, $locale);
        $list = (new \ReflectionProperty(DesignWords::class, 'words'))->getValue($words);

        foreach ((new ProPlaybooks(self::PRO_DIR, new DesignWords()))->entries() as $entry) {
            $this->assertSame([], array_values(array_diff(array_keys(DesignWords::wordsOfPlaybook($entry)), array_keys($list))), $entry['id'] . ' has words ' . $locale . ' lacks — run npm run templates:words');
        }

        $this->assertNotEmpty($list);
    }

    public function testThePaidListReachesAnInstalledSetupThroughTheFilter(): void
    {
        $GLOBALS['wconvertTestFilters']['wconvert_design_words'] = [static fn (array $words): array => $words + ['Only Pro has this' => 'Nur Pro hat das']];

        try {
            $setup = DesignWords::everyBundled('de_DE')->playbook(['name' => 'Only Pro has this']);
        } finally {
            unset($GLOBALS['wconvertTestFilters']['wconvert_design_words']);
        }

        $this->assertSame('Nur Pro hat das', $setup['name']);
    }
}
