<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * What the merchant supplied that is **not words**, carried across a
 * [[Template]] switch.
 *
 * =============================================================================
 * A MERCHANT WHO UPLOADED AN IMAGE AND THEN PICKED A NICER DESIGN LOST IT.
 * =============================================================================
 * Picking a design takes a fresh snapshot and rebinds the merchant's copy by
 * [[Slot Role]] — *"the words survive switching Template"* (CONTEXT.md,
 * Playbook). That is exactly right about words, and it is the whole of what
 * {@see SlotRoles} carries, because a Role names what a slot SAYS.
 *
 * Two of the things a merchant types are not words:
 *
 * - **An `image`'s `src` and `alt`.** `image` declares no `copy` at all, and it
 *   declares none deliberately: *"a template's image slot keeps the template's
 *   own asset or stays empty"* and a [[Playbook]] never supplies one
 *   (ADR 0013). So no Role binds to it, so nothing carried it, so an uploaded
 *   photo was replaced by the next design's stock artwork with no warning.
 * - **A `button`'s `href`.** It is CONTENT rather than a param — a
 *   click-metered CTA's destination is the merchant's to type (ADR 0010) — but
 *   it is not `copy`, so `cta_label` carries the button's words and drops the
 *   place it goes. A cart Optin came out of a design switch pointing nowhere.
 *
 * =============================================================================
 * IT CARRIES WHAT THEY CHANGED, AND ADOPTS THE NEW DESIGN WHERE THEY DID NOT.
 * =============================================================================
 * This is the distinction that makes the fix safe rather than merely
 * sympathetic. `withoutCopy()` strips only the `copy` keys, so an Optin's `src`
 * starts life as a byte-for-byte copy of the entry's own — which means
 * comparing the Optin against **the entry its copy was taken for** says exactly
 * whether a merchant ever touched it.
 *
 * - Different from the old entry's → the merchant's, and it travels.
 * - The same → they never touched it, and the new design's own asset stands.
 *   Carrying it would plant the *previous* template's stock photo into a design
 *   that shipped its own, which is ADR 0013's rule broken by a fix meant to
 *   honour it.
 * - Present where the old entry had no such node at all → theirs by
 *   construction. That is the block a merchant ADDED in the structure editor,
 *   and there is nothing it could be a copy of.
 *
 * **Where the old entry cannot be resolved, nothing is carried.** A create has
 * no prior entry, and an install may no longer ship the one an Optin came from.
 * Neither is a licence to guess: without something to compare against, "the
 * merchant's" and "the previous design's" are indistinguishable, and the
 * failure that costs them more is the one that silently overwrites a design's
 * own artwork.
 *
 * =============================================================================
 * MATCHED BY KIND AND ORDINAL, BECAUSE THERE IS NOTHING ELSE TO MATCH ON.
 * =============================================================================
 * A Role is the seam words travel on and an `image` has none — that is the
 * whole reason this class exists, so it cannot borrow the mechanism. What is
 * left is the merchant's own model: *my image*, *my button*. So the first
 * `image` of the old tree becomes the first `image` of the new one, in tree
 * order through both of a `split`'s panes.
 *
 * It is unambiguous for the case that matters. One Optin has exactly one
 * converting act (CONTEXT.md, Conversion), so there is exactly one `button`;
 * every shipped design carries at most one `image`. Beyond that the ordinal is
 * a defensible generalisation rather than a guarantee, and a design with fewer
 * slots than the last one simply has nowhere to put the extra — arrangement is
 * the new design's, and this adds no nodes.
 *
 * @since 0.1.0
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
        'image' => ['src', 'alt'],
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
