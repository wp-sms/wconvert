<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateNames;

/**
 * The designs' names, held to the JSON they were generated from.
 *
 * `labels.php` is written by `bin/template-labels.mjs` and applied over the
 * JSON's own names as a design is read, so a design renamed in JSON with the
 * labels left alone would show its OLD name — in every language, English
 * included. The suite's `_x()` hands the English back, so reading a labels
 * file here gives exactly what it would print untranslated, and that must be
 * what the JSON says.
 */
#[CoversClass(TemplateNames::class)]
final class TemplateNamesTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../';

    /** @return iterable<string, array{string, string}> */
    public static function sets(): iterable
    {
        yield 'free' => ['resources/templates/library/*.json', 'resources/templates/labels.php'];
        yield 'pro' => ['pro/modules/*/templates/*.json', 'pro/resources/templates/labels.php'];
    }

    #[DataProvider('sets')]
    public function testTheLabelsSayWhatTheDesignsSay(string $designs, string $labelsFile): void
    {
        $labels = require self::ROOT . $labelsFile;
        $ids = [];

        foreach (glob(self::ROOT . $designs) ?: [] as $file) {
            $design = json_decode((string) file_get_contents($file), true);
            $ids[] = $design['id'];
            $label = $labels[$design['id']] ?? null;

            $this->assertIsArray($label, "{$design['id']} has no labels — run npm run templates:labels");
            $this->assertSame($design['name'], $label['name'], "{$design['id']}'s name — run npm run templates:labels");

            $steps = [];
            foreach ($design['tree']['steps'] ?? [] as $step) {
                if (($step['name'] ?? '') !== '') $steps[$step['id']] = $step['name'];
            }
            $this->assertSame($steps, $label['steps'], "{$design['id']}'s screens — run npm run templates:labels");
        }

        sort($ids);
        $named = array_keys($labels);
        sort($named);
        $this->assertSame($ids, $named, 'the labels name a design that is not bundled — run npm run templates:labels');
    }

    public function testAppliesTheNameAndEachScreensNameAndLeavesTheRest(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'labels') . '.php';
        file_put_contents($file, "<?php return ['card' => ['name' => 'Karte', 'steps' => ['details' => 'Angaben']]];");

        try {
            $entries = TemplateNames::apply([
                ['id' => 'card', 'name' => 'Card', 'tree' => ['steps' => [['id' => 'details', 'name' => 'Details'], ['id' => 'other', 'name' => 'Other']]]],
                ['id' => 'downloaded', 'name' => 'Downloaded', 'tree' => ['steps' => []]],
            ], $file);
        } finally {
            unlink($file);
        }

        $this->assertSame('Karte', $entries[0]['name']);
        $this->assertSame(['Angaben', 'Other'], array_column($entries[0]['tree']['steps'], 'name'));
        $this->assertSame('Downloaded', $entries[1]['name'], 'a design the labels do not name keeps its own words');
    }

    public function testAMissingLabelsFileChangesNothing(): void
    {
        $entries = [['id' => 'card', 'name' => 'Card', 'tree' => ['steps' => []]]];

        $this->assertSame($entries, TemplateNames::apply($entries, '/nowhere/labels.php'));
    }
}
