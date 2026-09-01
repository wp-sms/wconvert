<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\NodeIdentities;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;

/**
 * **Every text node has a name, and the name does not move.**
 *
 * The property under test is *stability*, which is the only reason the key
 * exists: WPML and Polylang register a string by a NAME, so a string named by
 * its position in `steps[]` hands the French headline to the fine print the
 * moment a merchant reorders their design (ADR 0010, amended).
 *
 * The failures worth writing down are all the same failure — an id that is not
 * the id it was — arriving by four different doors: minting over an id further
 * down the tree, re-minting on a second save, two nodes sharing one, and a copy
 * inheriting the original's.
 */
#[CoversClass(NodeIdentities::class)]
#[CoversClass(TemplateVocabulary::class)]
final class NodeIdentityTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function vocabulary(): TemplateVocabulary
    {
        return TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    /**
     * @param list<array<string, mixed>> $steps
     * @return array{steps: list<array<string, mixed>>}
     */
    private static function normalize(array $steps): array
    {
        /** @var array{steps: list<array<string, mixed>>} $tree */
        $tree = self::vocabulary()->normalize(['tree' => ['steps' => $steps]])['tree'];

        return $tree;
    }

    /**
     * Every id in a tree, in the order the walk reached them.
     *
     * @param array<string, mixed> $tree
     * @return list<string>
     */
    private static function idsIn(array $tree): array
    {
        $found = [];

        $walk = static function ($node) use (&$walk, &$found): void {
            if (!is_array($node)) {
                return;
            }

            if (is_string($node['id'] ?? null)) {
                $found[] = $node['id'];
            }

            foreach ($node as $value) {
                $walk($value);
            }
        };

        $walk($tree);

        return $found;
    }

    public function testEveryLeafLeavesWithAnId(): void
    {
        $tree = self::normalize([[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'text' => 'Join'],
                ['type' => 'text', 'text' => 'One a month.'],
                ['type' => 'field', 'name' => 'email'],
            ],
        ]]);

        self::assertSame(['n1', 'n2', 'n3'], self::idsIn($tree));
    }

    /**
     * **A layout is not a string.** An id names something a translator has to
     * be handed, and a `stack` says nothing — so giving one an id would put
     * bytes on every page view of every matching page for a name nothing can
     * use.
     */
    public function testALayoutCarriesNone(): void
    {
        $tree = self::normalize([['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Join']]]]);

        self::assertArrayNotHasKey('id', $tree['steps'][0]);
        self::assertSame('n1', $tree['steps'][0]['children'][0]['id'] ?? null);
    }

    /** Both of a `split`'s panes, which is where a second reader forgets to look. */
    public function testItReachesBothPanesOfASplit(): void
    {
        $tree = self::normalize([[
            'type' => 'split',
            'start' => [['type' => 'image', 'src' => '/a.png', 'alt' => '']],
            'end' => [['type' => 'heading', 'text' => 'Join']],
        ]]);

        self::assertSame(['n1', 'n2'], self::idsIn($tree));
    }

    /**
     * **The one that matters.** Normalizing an already-normalized tree must
     * hand back the same names — every save runs through `normalize()`, so a
     * class that renumbered here would rename every string on the site every
     * time the merchant pressed Save.
     */
    public function testASecondSaveKeepsEveryId(): void
    {
        $once = self::normalize([[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'text' => 'Join'],
                ['type' => 'text', 'text' => 'One a month.'],
                ['type' => 'button', 'label' => 'Go', 'action' => 'submit'],
            ],
        ]]);

        /** @var list<array<string, mixed>> $steps */
        $steps = $once['steps'];

        self::assertSame(['n1', 'n2', 'n3'], self::idsIn($once));
        self::assertSame(['n1', 'n2', 'n3'], self::idsIn(self::normalize($steps)));
    }

    /**
     * A block moved, added above, or hidden does not rename anything below it.
     * This is the whole of what "stable" buys.
     */
    public function testRearrangingTheDesignMovesNoId(): void
    {
        $tree = self::normalize([[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'id' => 'n1', 'text' => 'Join'],
                ['type' => 'text', 'id' => 'n2', 'text' => 'One a month.'],
            ],
        ]]);

        /** @var array<string, mixed> $heading */
        $heading = $tree['steps'][0]['children'][0];
        /** @var array<string, mixed> $body */
        $body = $tree['steps'][0]['children'][1];

        $rearranged = self::normalize([[
            'type' => 'stack',
            'children' => [$body, ['type' => 'image', 'src' => '/a.png', 'alt' => ''], $heading],
        ]]);

        self::assertSame('n2', $rearranged['steps'][0]['children'][0]['id'] ?? null);
        self::assertSame('n1', $rearranged['steps'][0]['children'][2]['id'] ?? null);
        // The newcomer takes the lowest number nothing already holds, rather
        // than a number that was already spoken for.
        self::assertSame('n3', $rearranged['steps'][0]['children'][1]['id'] ?? null);
    }

    /**
     * **The pre-scan, which is the difference between stable and usually
     * stable.** Minting from a bare counter as the walk goes would hand the
     * first node `n1` — which the last node already holds — and the last node
     * would then be renamed.
     */
    public function testAMintedIdNeverTakesOneFromLaterInTheTree(): void
    {
        $tree = self::normalize([[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'text' => 'No id yet'],
                ['type' => 'text', 'id' => 'n1', 'text' => 'Had one all along.'],
            ],
        ]]);

        self::assertSame('n1', $tree['steps'][0]['children'][1]['id'] ?? null);
        self::assertNotSame('n1', $tree['steps'][0]['children'][0]['id'] ?? null);
    }

    /**
     * Two nodes claiming one name is one translation behind two sentences. The
     * later claimant is **re-minted** rather than dropped — a node with no id
     * is a node no translator can reach, which is a worse silence than a
     * renamed one.
     */
    public function testADuplicatedIdIsReMintedRatherThanShared(): void
    {
        $tree = self::normalize([[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'id' => 'n1', 'text' => 'First'],
                ['type' => 'text', 'id' => 'n1', 'text' => 'Second'],
            ],
        ]]);

        self::assertSame('n1', $tree['steps'][0]['children'][0]['id'] ?? null);
        self::assertSame('n2', $tree['steps'][0]['children'][1]['id'] ?? null);
    }

    /**
     * The shape is closed, because the id becomes part of a WPML string name.
     *
     * @param mixed $id
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('unusableIds')]
    public function testAnIdOutsideTheShapeIsReplaced($id): void
    {
        $tree = self::normalize([['type' => 'heading', 'id' => $id, 'text' => 'Join']]);

        self::assertSame('n1', $tree['steps'][0]['id'] ?? null);
    }

    /** @return array<string, array{mixed}> */
    public static function unusableIds(): array
    {
        return [
            'a path separator collides with the WPML name' => ['optin/n1'],
            'not the shape at all' => ['headline'],
            'zero-prefixed, so two spellings of one number' => ['n01'],
            'longer than four digits' => ['n12345'],
            'empty' => [''],
            'not a string' => [7],
            'an array, which is how an injection arrives' => [['n1']],
        ];
    }

    /**
     * **Every shipped design names its own nodes**, rather than relying on the
     * mint.
     *
     * The ids would be identical either way — the walk is deterministic — so
     * this is not about the values. It is about what happens when somebody
     * reorders a library file: written down, the id travels with the node it
     * names; left to the mint, every node below the edit is renamed and every
     * translation on every site that uses that design moves with it.
     */
    public function testEveryShippedLibraryLeafNamesItselfInTheFile(): void
    {
        $leaves = array_keys((array) (TemplateManifest::load(self::PLUGIN_DIR)['nodes'] ?? []));

        self::assertNotSame([], $leaves, 'the manifest has to declare some leaves for this to mean anything');

        foreach (glob(self::PLUGIN_DIR . '/resources/templates/library/*.json') ?: [] as $file) {
            /** @var array<string, mixed> $entry */
            $entry = json_decode((string) file_get_contents($file), true);
            $name = basename($file);

            $walk = static function ($node) use (&$walk, $leaves, $name): void {
                if (!is_array($node)) {
                    return;
                }

                if (in_array($node['type'] ?? null, $leaves, true)) {
                    self::assertMatchesRegularExpression(
                        '/^n[1-9][0-9]{0,3}$/',
                        (string) ($node['id'] ?? ''),
                        "{$name}: a {$node['type']} does not name itself"
                    );
                }

                foreach ($node as $value) {
                    $walk($value);
                }
            };

            $walk($entry['tree'] ?? []);
        }
    }
}
