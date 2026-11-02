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
use WConvert\Template\TemplateSource;
use WConvert\Template\TemplateVocabulary;

/**
 * Every language, over the designs and setups only the online library serves.
 *
 * Publishing refuses an object the full validator refuses, but publishing is rare and
 * runs the renderer. So the same promise is held here, on every pull request, the way
 * `LibraryLintTest` holds the English: every hosted design registers within its byte
 * cap, measured as installed, and every hosted setup registers. Read straight from the
 * `.po`, because a hosted word has no list until a release is built.
 */
#[CoversNothing]
final class HostedDesignWordsTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../';
    private const HOSTED = self::ROOT . 'tools/design-library/hosted/';

    /** @return iterable<string, array{string}> */
    public static function locales(): iterable
    {
        foreach (glob(self::ROOT . 'tools/design-library/translations/*.po') ?: [] as $file) {
            yield basename($file, '.po') => [basename($file, '.po')];
        }
    }

    private static function words(string $locale): DesignWords
    {
        $text = (string) file_get_contents(self::ROOT . 'tools/design-library/translations/' . $locale . '.po');
        preg_match_all('/^msgid (".+")\nmsgstr (".*")$/m', $text, $pairs, PREG_SET_ORDER);
        $list = [];
        foreach ($pairs as [, $english, $translated]) $list[json_decode($english)] = json_decode($translated);

        return new DesignWords(DesignWords::readList($list), TemplateManifest::load());
    }

    private static function library(DesignWords $words): TemplateLibrary
    {
        return TemplateLibrary::from(TemplateVocabulary::fromManifest(), new class ($words) implements TemplateSource {
            public function __construct(private readonly DesignWords $words)
            {
            }

            public function entries(): array
            {
                return array_map(
                    fn (string $file): array => $this->words->templateOrEnglish(self::installed(json_decode((string) file_get_contents($file), true))),
                    glob(HostedDesignWordsTest::hostedDirectory() . 'templates/*.json') ?: []
                );
            }

            /** A picture is a local URL once installed (`LibraryLintTest` measures the same). */
            private static function installed(mixed $node): mixed
            {
                if (!is_array($node)) {
                    return $node;
                }
                if (($node['type'] ?? '') === 'image' && str_starts_with((string) ($node['src'] ?? ''), 'data:')) {
                    $node['src'] = 'https://example.test/wp-content/uploads/wconvert/catalog/' . hash('sha256', (string) $node['src']) . '/image-' . substr(hash('sha256', (string) $node['src']), 0, 24) . '.webp';
                }
                foreach (['tokens', 'narrow'] as $bag) {
                    $image = $node[$bag]['bg-image'] ?? null;
                    if (is_string($image) && preg_match('/^url\([\x22\x27]?(data:[^\x22\x27)]+)[\x22\x27]?\)$/', $image, $match)) {
                        $node[$bag]['bg-image'] = 'url("https://example.test/wp-content/uploads/wconvert/catalog/' . hash('sha256', $match[1]) . '/image-' . substr(hash('sha256', $match[1]), 0, 24) . '.webp")';
                    }
                }

                return array_map(fn (mixed $child): mixed => self::installed($child), $node);
            }
        });
    }

    public static function hostedDirectory(): string
    {
        return self::HOSTED;
    }

    #[DataProvider('locales')]
    public function testEveryHostedDesignRegistersWithinItsBudget(string $locale): void
    {
        $english = self::library(new DesignWords());
        $translated = self::library(self::words($locale));

        $this->assertSame(array_keys($english->all()), array_keys($translated->all()));

        $over = [];
        foreach (array_keys($translated->all()) as $id) {
            $bytes = strlen((string) gzencode((string) json_encode($translated->snapshotInto(['template_id' => (string) $id])['template'] ?? []), 9));
            if ($bytes > DesignBudget::PER_DESIGN) $over[$id] = $bytes;
        }

        $this->assertSame([], $over, 'gzipped bytes against a ' . DesignBudget::PER_DESIGN . ' B cap in ' . $locale);
    }

    #[DataProvider('locales')]
    public function testEveryHostedWordHasATranslation(string $locale): void
    {
        $words = self::words($locale);
        $manifest = TemplateManifest::load();
        $english = [];

        foreach (glob(self::HOSTED . 'templates/*.json') ?: [] as $file) {
            $design = json_decode((string) file_get_contents($file), true);
            if ($words->templateOrEnglish($design) === $design) $english[] = $design['id'];
        }

        $this->assertSame([], $english, 'stay English in ' . $locale . ' — run npm run templates:words');
        $this->assertNotSame([], DesignWords::wordsOfTemplate($design ?? [], $manifest));
    }

    #[DataProvider('locales')]
    public function testEveryHostedSetupStillRegisters(string $locale): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $words = self::words($locale);
        $templates = TemplateLibrary::from($vocabulary, new BundledTemplates(self::ROOT, $words), self::proSource($words), new class ($words) implements TemplateSource {
            public function __construct(private readonly DesignWords $words)
            {
            }

            public function entries(): array
            {
                return array_map(fn (string $file): array => $this->words->templateOrEnglish(json_decode((string) file_get_contents($file), true)), glob(HostedDesignWordsTest::hostedDirectory() . 'templates/*.json') ?: []);
            }
        });
        $setups = array_map(static fn (string $file): array => $words->playbookOrEnglish(require $file), glob(self::HOSTED . 'playbooks/*.php') ?: []);

        $library = PlaybookLibrary::fromEntries($setups, $templates, $vocabulary, RuleVocabulary::fromManifest());

        $this->assertSame([], $library->rejections(), 'a hosted setup was rejected in ' . $locale);
    }

    private static function proSource(DesignWords $words): TemplateSource
    {
        return new \WConvert\Pro\Template\ProTemplates(self::ROOT . 'pro', $words);
    }
}
