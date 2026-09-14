<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Merchant button destinations carried beside Slot Role copy.
 * Pictures and their crop settings are handled by PictureTransfer.
 */
final class MerchantsOwn
{
    /**
     * The keys a merchant supplies that no [[Slot Role]] carries, per node type.
     *
     * Deliberately a short, closed list rather than "every content key that is
     * not copy". The general rule would sweep in `field`'s `label` and
     * `placeholder`, which ARE words and are already carried by the Roles
     * derived from what the field captures — so the two mechanisms would write
     * the same slot twice and the order would decide the winner.
     */
    private const KEYS = [
        'button' => ['href'],
    ];

    /**
     * What the merchant changed, keyed by node type and then by ordinal.
     *
     * @param mixed $mine The Optin's current tree.
     * @param mixed $design The tree of the entry that copy was taken FOR, or null.
     * @return array<string, array<int, array<string, mixed>>>
     */
    public static function changedIn($mine, $design): array
    {
        if (!is_array($design)) {
            return [];
        }

        $held = self::nodesByKind($mine);
        $shipped = self::nodesByKind($design);
        $changed = [];

        foreach ($held as $type => $nodes) {
            foreach ($nodes as $at => $node) {
                $was = $shipped[$type][$at] ?? null;

                foreach (self::KEYS[$type] as $key) {
                    $value = $node[$key] ?? null;

                    // Absent both sides, or identical: the design's, not
                    // theirs. `null` is written back nowhere, so a merchant who
                    // CLEARED a value gets the new design's own — which is what
                    // an empty slot has always meant here (ADR 0013).
                    if ($value === null || $value === ($was[$key] ?? null)) {
                        continue;
                    }

                    $changed[$type][$at][$key] = $value;
                }
            }
        }

        return $changed;
    }

    /**
     * The same tree with those values written over the new design's.
     *
     * Written per key rather than per node, so a merchant who replaced the
     * picture and left the alt text alone keeps the new design's alt text — the
     * same granularity {@see SlotRoles::write()} has, and for the same reason.
     *
     * @param array{steps: list<array<string, mixed>>} $tree
     * @param array<string, array<int, array<string, mixed>>> $changed
     * @return array{steps: list<array<string, mixed>>}
     */
    public static function writeInto(array $tree, array $changed): array
    {
        if ($changed === []) {
            return $tree;
        }

        $seen = [];

        return TemplateTree::rewrittenIn(
            ['template' => ['tree' => $tree]],
            static function (array $node) use ($changed, &$seen): array {
                $type = is_string($node['type'] ?? null) ? $node['type'] : '';

                if (!array_key_exists($type, self::KEYS)) {
                    return $node;
                }

                $at = $seen[$type] ?? 0;
                $seen[$type] = $at + 1;

                return array_merge($node, $changed[$type][$at] ?? []);
            }
        )['template']['tree'];
    }

    /**
     * Every node of an interesting kind, in tree order, grouped by kind.
     *
     * The walk goes through {@see TemplateTree::childrenOf()} so a `split`'s
     * far pane is counted — which is the one place an ordinal would otherwise
     * quietly disagree between the two trees being compared.
     *
     * @param mixed $tree
     * @return array<string, list<array<string, mixed>>>
     */
    private static function nodesByKind($tree): array
    {
        $tree = is_array($tree) ? $tree : [];
        $found = [];

        $steps = is_array($tree['steps'] ?? null) ? array_values($tree['steps']) : [];

        foreach (self::inOrder($steps) as $node) {
            $type = is_string($node['type'] ?? null) ? $node['type'] : '';

            if (array_key_exists($type, self::KEYS)) {
                $found[$type][] = $node;
            }
        }

        return $found;
    }

    /**
     * Every node under these, and them, in tree order.
     *
     * @param list<mixed> $nodes
     * @return list<array<string, mixed>>
     */
    private static function inOrder(array $nodes): array
    {
        $flat = [];

        foreach ($nodes as $node) {
            if (!is_array($node)) {
                continue;
            }

            $flat[] = $node;
            $flat = array_merge($flat, self::inOrder(TemplateTree::childrenOf($node)));
        }

        return $flat;
    }
}
