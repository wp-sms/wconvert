<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * Walking a template's node tree.
 *
 * One place that knows where a layout keeps its children, because four
 * readers now need it — {@see PolicyLink} resolving the site's privacy policy,
 * {@see CartLink} resolving the way back to the cart,
 * {@see \WConvert\Lead\CaptureForm} reading what a form declares, and whatever
 * reads a tree next. Four copies of `['children', 'start', 'end']` is four
 * chances for one of them to miss a `split`'s far pane, which fails silently:
 * the node is simply never visited.
 *
 * **{@see self::rewrittenIn()} is why the two link resolvers are a rule each
 * rather than a walk each.** They arrived one ticket apart and the second was
 * written by copying the first — same dig into `template.tree.steps`, same
 * recursion, one predicate different. That is the shape this class exists to
 * hold, so the walk moved here and each resolver kept only the sentence it can
 * argue for.
 *
 * Deliberately NOT merged into {@see TemplateVocabulary}. That class derives
 * the child keys PER LAYOUT from the manifest, which is the stricter question
 * a validator has to ask on the way in; these readers walk a tree that is
 * already validated and only need to know where children can be.
 *
 * @since 0.1.0
 */
final class TemplateTree
{
    /**
     * Every key a node may keep children under. `split` is the one with two,
     * and they are `start`/`end` rather than `left`/`right` for the same
     * reason the stylesheet is written in logical properties: writing
     * direction crosses every boundary (ADR 0009).
     */
    public const CHILD_KEYS = ['children', 'start', 'end'];

    /**
     * One payload's tree, with every node passed through `$rewrite`.
     *
     * The dig into `template.tree.steps` is here rather than at each caller
     * for the reason the child keys are: a payload whose snapshot is missing
     * or malformed comes back UNTOUCHED rather than throwing, and one reader
     * remembering that and another not is exactly the asymmetry that ends in a
     * fatal on a page WConvert was asked to leave alone (ADR 0004).
     *
     * `$rewrite` sees every node, layout and leaf alike, and returns the node
     * it wants. **Its own children are walked afterwards**, so a rewrite may
     * change a node's content without having to think about recursion — which
     * is the whole of what a link resolver does.
     *
     * An entry nothing was done to comes back byte-identical, which matters
     * because the payload is inlined into every matching page against a 2KB
     * budget.
     *
     * @param array<string, mixed> $payload One entry, as it travels to the browser.
     * @param callable(array<string, mixed>): array<string, mixed> $rewrite
     * @return array<string, mixed>
     */
    public static function rewrittenIn(array $payload, callable $rewrite): array
    {
        $steps = $payload['template']['tree']['steps'] ?? null;

        if (!is_array($steps)) {
            return $payload;
        }

        $payload['template']['tree']['steps'] = array_map(
            static fn ($step): mixed => is_array($step) ? self::rewrite($step, $rewrite) : $step,
            array_values($steps)
        );

        return $payload;
    }

    /**
     * @param array<string, mixed> $node
     * @param callable(array<string, mixed>): array<string, mixed> $rewrite
     * @return array<string, mixed>
     */
    private static function rewrite(array $node, callable $rewrite): array
    {
        $node = $rewrite($node);

        foreach (self::CHILD_KEYS as $key) {
            if (is_array($node[$key] ?? null)) {
                $node[$key] = array_map(
                    static fn ($child): mixed => is_array($child) ? self::rewrite($child, $rewrite) : $child,
                    array_values($node[$key])
                );
            }
        }

        return $node;
    }

    /**
     * Every child of one node, in tree order, whichever key holds it.
     *
     * @param array<string, mixed> $node
     * @return list<mixed>
     */
    public static function childrenOf(array $node): array
    {
        $children = [];

        foreach (self::CHILD_KEYS as $key) {
            if (is_array($node[$key] ?? null)) {
                $children = array_merge($children, array_values($node[$key]));
            }
        }

        return $children;
    }
}
