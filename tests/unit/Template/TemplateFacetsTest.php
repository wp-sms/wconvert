<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateFacets;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * Every facet is DERIVED, so this asserts the derivation against the designs
 * that are actually shipped.
 *
 * ============================================================================
 * THE FAILURE THIS EXISTS TO CATCH IS A CHIP THAT LIES.
 * ============================================================================
 * A merchant filters to *"Asks for: Phone number"*, gets four cards, and one of
 * them has no phone field on it. Nothing crashes and no test fails — the card
 * renders, the design is fine, and the only person who finds out is the one who
 * picked it. That is the whole class of fault a derived facet is supposed to
 * make impossible, and it is only impossible if something walks the real trees.
 *
 * So the fixture is the LIBRARY rather than a hand-written tree: a design added
 * to `resources/templates/library/` is walked here the day it lands, and one
 * whose facets disagree with what its tree contains fails before it ships.
 */
#[CoversClass(TemplateFacets::class)]
final class TemplateFacetsTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function vocabulary(): TemplateVocabulary
    {
        return TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    /**
     * Every shipped entry, keyed by id, with the facets registration gave it.
     *
     * @return array<string, array<string, mixed>>
     */
    private static function shipped(): array
    {
        return TemplateLibrary::fromDirectory(self::vocabulary(), self::PLUGIN_DIR)->all();
    }

    /**
     * @return list<array{string, array<string, mixed>}>
     */
    public static function entries(): array
    {
        return array_map(
            static fn (string $id, array $entry): array => [$id, $entry],
            array_keys(self::shipped()),
            array_values(self::shipped())
        );
    }

    public function testTheLibraryIsBigEnoughForThisToAssertSomething(): void
    {
        // The picker was designed for a library ten times the size of the three
        // it had, and the toolbar only appears once the set is large enough to
        // need it. A suite that passed on three entries would prove nothing
        // about the screen this ticket built.
        $this->assertGreaterThanOrEqual(10, count(self::shipped()));
    }

    /**
     * **Registration hands every entry its facets**, so nothing downstream has
     * to remember to ask for them — which is what makes the index route able to
     * withhold trees at all.
     *
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testEveryShippedEntryCarriesEveryFacet(string $id, array $entry): void
    {
        $this->assertArrayHasKey('facets', $entry, $id . ' registered without facets');
        $this->assertSame(
            ['act', 'captures', 'shape', 'has_image', 'asks_consent'],
            array_keys($entry['facets']),
            $id . ' carries a different set of facets from every other entry'
        );
    }

    /**
     * The act is singular **by construction**: `TemplateLibrary::refuse()`
     * rejects two and rejects none before an entry is ever registered, so
     * anything that reads a registered entry's `act` is reading one word
     * (ADR 0020).
     *
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testEveryShippedEntryConvertsOnExactlyOneNamedAct(string $id, array $entry): void
    {
        $this->assertContains($entry['facets']['act'], ['submit', 'click'], $id . ' converts on nothing nameable');
    }

    /**
     * `shape` is step 0's root layout, and it has to be a layout the manifest
     * declares — otherwise the chip strip draws a value
     * {@see \WConvert\Template\TemplateLabels::facetValues()} has no word for.
     *
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testEveryShippedEntryHasAShapeTheChipStripCanName(string $id, array $entry): void
    {
        $offered = self::vocabulary()->facets()['shape'];

        $this->assertContains($entry['facets']['shape'], $offered, $id . ' is arranged in a way no chip names');
    }

    /**
     * ==========================================================================
     * THE CHIP AND THE TREE SAY THE SAME THING, CHECKED THE HARD WAY.
     * ==========================================================================
     * Recounted from the raw tree rather than from the facet map, because
     * asserting the map against itself would pass on any derivation at all.
     *
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testWhatACardClaimsToCaptureIsWhatItsTreeAsksFor(string $id, array $entry): void
    {
        $this->assertSame(
            self::fieldsIn($entry['tree']),
            $entry['facets']['captures'],
            $id . ' claims to capture something its tree does not ask for'
        );
    }

    /**
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testAPictureChipMeansAPictureInTheTree(string $id, array $entry): void
    {
        $this->assertSame(
            // Fieldwork is the bundled picture implemented as a background;
            // Ink split and Inline tinted have decorative gradients instead.
            self::hasNode($entry['tree'], 'image') || $id === 'fieldwork',
            $entry['facets']['has_image'],
            $id . ' disagrees with its own tree about whether it has a picture'
        );
    }

    public function testAVisibleBackgroundPictureDoesNotNeedAnImageNode(): void
    {
        $picture = 'url("https://example.org/picture.jpg")';
        $tree = ['steps' => [[
            'type' => 'split',
            'start' => [['type' => 'heading', 'text' => 'Hello']],
            'end' => [['type' => 'media', 'tokens' => ['bg-image' => $picture], 'children' => []]],
        ]]];

        $this->assertTrue(TemplateFacets::of($tree, [])['has_image']);
        $this->assertTrue(TemplateFacets::of(['steps' => []], [], ['bg-image' => $picture])['has_image']);
        $this->assertTrue(TemplateFacets::of(['steps' => [[
            'type' => 'panel', 'narrow' => ['bg-image' => $picture], 'children' => [],
        ]]], [])['has_image']);
    }

    public function testAnUnusedBackgroundTokenOrColourWashIsNotAPicture(): void
    {
        foreach (['none', 'linear-gradient(#fff,#000)', ''] as $background) {
            $this->assertFalse(TemplateFacets::of(['steps' => [[
                'type' => 'panel', 'tokens' => ['bg-image' => $background], 'children' => [],
            ]]], [], ['bg-image' => $background])['has_image']);
        }

        // Rows do not paint this token, and panels reset an ancestor's image.
        $this->assertFalse(TemplateFacets::of(['steps' => [[
            'type' => 'row',
            'tokens' => ['bg-image' => 'url("https://example.org/picture.jpg")'],
            'children' => [['type' => 'panel', 'children' => []]],
        ]]], [])['has_image']);
    }

    /**
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testConsentIsDerivedFromTheConsentNode(string $id, array $entry): void
    {
        $this->assertSame(
            self::hasNode($entry['tree'], 'consent'),
            $entry['facets']['asks_consent'],
            $id . ' disagrees with its own tree about consent'
        );
    }

    /**
     * **The far pane of a `split` is exactly where a facet hides.** Walked
     * through `TemplateTree::childrenOf()` on the production side; asserted here
     * against a tree whose only `image` and only `field` are in `end`.
     */
    public function testItReadsBothPanesOfASideBySide(): void
    {
        $facets = TemplateFacets::of([
            'steps' => [
                [
                    'type' => 'split',
                    'start' => [['type' => 'heading', 'text' => 'Hello']],
                    'end' => [
                        ['type' => 'image', 'src' => 'data:,'],
                        ['type' => 'field', 'name' => 'email'],
                        ['type' => 'button', 'action' => 'submit'],
                    ],
                ],
                ['type' => 'stack', 'children' => []],
            ],
        ], ['email', 'name', 'phone']);

        $this->assertSame('split', $facets['shape']);
        $this->assertTrue($facets['has_image']);
        $this->assertSame(['email'], $facets['captures']);
        $this->assertSame('submit', $facets['act']);
    }

    /**
     * **Step 0's shape, and only step 0's.** A submit-metered design has a
     * terminal success step whose arrangement follows from having two lines in
     * it (ADR 0025) — so reading every step would make a Side by side with a
     * Column success state a design with no shape at all.
     */
    public function testTheShapeIsTheFirstStepsAndNotTheSuccessStates(): void
    {
        $facets = TemplateFacets::of([
            'steps' => [
                [
                    'type' => 'row',
                    'children' => [['type' => 'field', 'name' => 'email'], ['type' => 'button']],
                ],
                ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Done']]],
            ],
        ], ['email']);

        $this->assertSame('row', $facets['shape']);
    }

    /**
     * A field kind the manifest does not declare cannot become a chip, because
     * the chip strip enumerates the manifest and would have no word for it.
     */
    public function testAFieldTheVocabularyDoesNotDeclareIsNotACapture(): void
    {
        $facets = TemplateFacets::of([
            'steps' => [[
                'type' => 'stack',
                'children' => [
                    ['type' => 'field', 'name' => 'shoe_size'],
                    ['type' => 'field', 'name' => 'email'],
                    ['type' => 'button', 'action' => 'submit'],
                ],
            ]],
        ], ['email', 'name', 'phone']);

        $this->assertSame(['email'], $facets['captures']);
    }

    /**
     * ==========================================================================
     * AN AUTHORED STUB PRODUCES THE SAME SHAPE AS A DERIVED ENTRY.
     * ==========================================================================
     * That is what lets the picker draw a locked card with the code that draws a
     * real one, so a premium design interleaves in place rather than being a
     * second kind of thing the grid has to know about.
     */
    public function testAnAuthoredStubIsTheSameShapeAsADerivedOne(): void
    {
        $derived = TemplateFacets::of(['steps' => []], []);
        $authored = TemplateFacets::authored(
            ['shape' => 'split', 'captures' => ['email'], 'has_image' => true],
            self::vocabulary()->facets()
        );

        $this->assertSame(array_keys($derived), array_keys($authored));
        $this->assertSame('split', $authored['shape']);
        $this->assertSame(['email'], $authored['captures']);
        $this->assertTrue($authored['has_image']);
    }

    /**
     * The exception that authoring is stays fenced: a stub claiming a shape no
     * layout declares, or a capture no field kind declares, would draw a chip
     * nothing in this admin can name.
     */
    public function testAnAuthoredStubCannotInventAFacetValue(): void
    {
        $authored = TemplateFacets::authored(
            ['shape' => 'carousel', 'captures' => ['email', 'shoe_size'], 'has_image' => 'yes'],
            self::vocabulary()->facets()
        );

        $this->assertNull($authored['shape']);
        $this->assertSame(['email'], $authored['captures']);
        $this->assertFalse($authored['has_image']);
    }

    /**
     * Every design free ships, in the two Display Types free can render
     * (`mount.ts`, ADR 0015). A `floating_bar` entry in the free ZIP would be a
     * card whose design this install cannot put on a page.
     *
     * @param array<string, mixed> $entry
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('entries')]
    public function testFreeShipsOnlyTheDisplayTypesFreeCanRender(string $id, array $entry): void
    {
        $this->assertContains($entry['display_type'], ['popup', 'inline'], $id . ' cannot be rendered by free');
    }

    /**
     * @param array<string, mixed> $tree
     * @return list<string>
     */
    private static function fieldsIn(array $tree): array
    {
        $found = [];

        self::each($tree, static function (array $node) use (&$found): void {
            if (($node['type'] ?? null) === 'field' && is_string($node['name'] ?? null)) {
                $found[$node['name']] = true;
            }
        });

        return array_values(array_filter(self::vocabulary()->fields(), static fn (string $f): bool => isset($found[$f])));
    }

    /**
     * @param array<string, mixed> $tree
     */
    private static function hasNode(array $tree, string $type): bool
    {
        $found = false;

        self::each($tree, static function (array $node) use ($type, &$found): void {
            $found = $found || ($node['type'] ?? null) === $type;
        });

        return $found;
    }

    /**
     * A walk written OUT rather than reusing `TemplateTree`, so this test does
     * not agree with the production code by sharing its bug.
     *
     * @param array<string, mixed> $tree
     * @param callable(array<string, mixed>): void $visit
     */
    private static function each(array $tree, callable $visit): void
    {
        $queue = is_array($tree['steps'] ?? null) ? array_values($tree['steps']) : [];

        while ($queue !== []) {
            $node = array_shift($queue);

            if (!is_array($node)) {
                continue;
            }

            $visit($node);

            foreach (['children', 'start', 'end'] as $key) {
                if (is_array($node[$key] ?? null)) {
                    $queue = array_merge($queue, array_values($node[$key]));
                }
            }
        }
    }
}
