<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * Walking a template's node tree.
 *
 * One place that knows where a layout keeps its children, because three
 * readers now need it — {@see PolicyLink} resolving site links,
 * {@see \WConvert\Lead\CaptureForm} reading what a form declares, and whatever
 * reads a tree next. Three copies of `['children', 'start', 'end']` is three
 * chances for one of them to miss a `split`'s far pane, which fails silently:
 * the node is simply never visited.
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
