<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\BundledTemplates;
use WConvert\Template\DesignBudget;
use WConvert\Template\DesignWords;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;

/**
 * Every shipped language, read the way a site reads it.
 *
 * A translation reaches a bundled design past the pack validator, and the plain
 * library's limits fail silently: a long screen name is truncated, an answer over
 * its limit is dropped. So each language is held here to what English is held to:
 * every design still registers, none rejected, none over its byte cap. Prefilling
 * the words back in must not drop one either.
 */
#[CoversNothing]
final class ShippedDesignWordsTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../';

    /** @return iterable<string, array{string}> */
    public static function locales(): iterable
    {
        foreach (glob(self::ROOT . DesignWords::PATH . '/*.json') ?: [] as $file) {
            yield basename($file, '.json') => [basename($file, '.json')];
        }
    }

    /** @return array<string, mixed> */
    private static function designs(TemplateVocabulary $vocabulary, ?DesignWords $words): array
    {
        return TemplateLibrary::from($vocabulary, new BundledTemplates(self::ROOT, $words ?? new DesignWords()))->all();
    }

    #[DataProvider('locales')]
    public function testEveryDesignStillRegistersWithinItsBudget(string $locale): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $english = self::designs($vocabulary, null);
        $translated = TemplateLibrary::from($vocabulary, new BundledTemplates(self::ROOT, DesignWords::bundled(self::ROOT, $locale)));

        $this->assertSame(array_keys($english), array_keys($translated->all()));

        $over = [];
        foreach (array_keys($translated->all()) as $id) {
            $bytes = strlen((string) gzencode((string) json_encode($translated->snapshotInto(['template_id' => (string) $id])['template'] ?? []), 9));
            if ($bytes > DesignBudget::PER_DESIGN) $over[$id] = $bytes;
        }

        $this->assertSame([], $over, 'gzipped bytes against a ' . DesignBudget::PER_DESIGN . ' B cap in ' . $locale);
    }

    #[DataProvider('locales')]
    public function testNoWordIsDroppedOrCutOnTheWayIn(string $locale): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $manifest = TemplateManifest::load();
        $words = DesignWords::bundled(self::ROOT, $locale);
        $translated = TemplateLibrary::from($vocabulary, new BundledTemplates(self::ROOT, $words));

        foreach ($translated->all() as $id => $entry) {
            $source = json_decode((string) file_get_contents(self::ROOT . BundledTemplates::PATH . '/' . $id . '.json'), true);
            $expected = array_keys(DesignWords::wordsOfTemplate($words->template($source), $manifest));
            $kept = array_keys(DesignWords::wordsOfTemplate($entry, $manifest));

            $this->assertSame([], array_values(array_diff($expected, $kept)), $id . ' lost words in ' . $locale);
        }
    }

    #[DataProvider('locales')]
    public function testEverySetupStillRegisters(string $locale): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $rules = RuleVocabulary::fromManifest();
        $words = DesignWords::bundled(self::ROOT, $locale);
        $templates = TemplateLibrary::from($vocabulary, new BundledTemplates(self::ROOT, $words));
        $english = PlaybookLibrary::fromDirectory(TemplateLibrary::from($vocabulary, new BundledTemplates(self::ROOT, new DesignWords())), $vocabulary, $rules, self::ROOT, [], new DesignWords());
        $library = PlaybookLibrary::fromDirectory($templates, $vocabulary, $rules, self::ROOT, [], $words);

        $this->assertSame(array_keys($english->all()), array_keys($library->all()));
    }

    #[DataProvider('locales')]
    public function testASiteInThatLanguageReadsEveryWordTranslated(string $locale): void
    {
        $manifest = TemplateManifest::load();
        $words = DesignWords::bundled(self::ROOT, $locale);
        $list = (new \ReflectionProperty(DesignWords::class, 'words'))->getValue($words);

        foreach (glob(self::ROOT . BundledTemplates::PATH . '/*.json') ?: [] as $file) {
            $design = json_decode((string) file_get_contents($file), true);
            $missing = array_diff(array_keys(DesignWords::wordsOfTemplate($design, $manifest)), array_keys($list));

            $this->assertSame([], array_values($missing), basename($file) . ' has words ' . $locale . ' lacks — run npm run templates:words');
        }
    }
}
