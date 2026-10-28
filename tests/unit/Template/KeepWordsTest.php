<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;

/**
 * #372: Change template with "Keep my words" kept the merchant's words where a
 * screen matched and left every other slot empty. A quiz's screens are matched
 * by identity, so switching quizzes blanked most of the new one.
 */
final class KeepWordsTest extends TestCase
{
    public function testSwitchingQuizzesLeavesNoSlotEmptyAndKeepsTheWordsThatMatch(): void
    {
        $root = dirname(__DIR__, 3);
        $vocabulary = TemplateVocabulary::fromManifest($root);
        $entries = array_map(static fn (string $id): array => json_decode((string) file_get_contents($root . '/pro/modules/journeys/templates/' . $id . '.json'), true, 512, JSON_THROW_ON_ERROR), ['gift-edit', 'journey-product-finder']);
        $library = TemplateLibrary::from($vocabulary, new class($entries) implements \WConvert\Template\TemplateSource {
            /** @param list<array<string, mixed>> $values */
            public function __construct(private array $values) {}
            public function entries(): array { return $this->values; }
        });
        $gift = $library->find('gift-edit');
        $finder = $library->find('journey-product-finder');
        self::assertNotNull($gift);
        self::assertNotNull($finder);

        // The merchant's own words, so a carried slot is told from a sampled one.
        $held = TemplateTree::rewrittenIn(['template' => ['tree' => $gift['tree'], 'tokens' => $gift['tokens']]], static function (array $node): array {
            foreach (['text', 'label'] as $key) {
                if (is_string($node[$key] ?? null) && $node[$key] !== '') $node[$key] = 'Mine: ' . $node[$key];
            }
            return $node;
        });
        $switched = $library->snapshotInto(['template_id' => 'journey-product-finder', 'template' => $held['template']], 'gift-edit')['template']['tree'];

        $sample = self::nodes($finder['tree']);
        $result = self::nodes($switched);
        self::assertCount(count($sample), $result, 'the new design keeps its own shape');
        $mine = 0;
        foreach ($sample as $at => $node) {
            foreach (['text', 'label'] as $key) {
                if (!is_string($node[$key] ?? null) || $node[$key] === '') continue;
                $words = $result[$at][$key] ?? null;
                self::assertIsString($words, "{$node['type']}.{$key} at {$at} is blank");
                self::assertNotSame('', $words, "{$node['type']}.{$key} at {$at} is blank");
                if (str_starts_with($words, 'Mine: ')) $mine++;
            }
        }
        self::assertGreaterThan(0, $mine, 'the words that match a slot are the merchant’s');
    }

    /**
     * @param array<string, mixed> $tree
     * @return list<array<string, mixed>>
     */
    private static function nodes(array $tree): array
    {
        $found = [];
        $walk = static function (array $node) use (&$walk, &$found): void {
            $found[] = $node;
            foreach (TemplateTree::childrenOf($node) as $child) if (is_array($child)) $walk($child);
        };
        foreach ($tree['steps'] as $step) $walk($step['content']);
        return $found;
    }
}
