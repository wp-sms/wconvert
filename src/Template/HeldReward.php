<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The codes and resource links a signup earns, kept out of the page until
 * the signup is accepted (ADR 0164).
 *
 * A step is **held** when the visitor can reach it only through an accepted
 * primary submission — the rule that already places a `followup`. On a held
 * step every `code` loses `text` and `apply_href`, every `followup` loses
 * `href`, and each is printed hidden. The values travel back in the capture
 * reply, and the loader fills them in before it draws the next screen.
 *
 * **Addressed by position, because nodes have no ids.** The reward is a list
 * per step id, one entry per `code` and `followup` in tree order, with `null`
 * where the node is not shown — switched off, or under a switched-off layout —
 * so its value is dropped from the page and never sent. The loader walks the
 * same tree, and the capture contract fingerprints its layout, so a cached
 * page whose positions differ is refused as changed before it is rewarded.
 *
 * Pure: it reads a tree and writes nothing.
 */
final class HeldReward
{
    private const VALUES = ['code' => ['text', 'apply_href'], 'followup' => ['href']];

    /**
     * The tree as the page prints it.
     *
     * @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    public static function printed(array $tree): array
    {
        return self::walk($tree)[0];
    }

    /**
     * What the primary submission's reply carries: the held values, by step id.
     *
     * @param array<string, mixed> $tree
     * @return array<string, list<array<string, mixed>|null>>
     */
    public static function of(array $tree): array
    {
        return self::walk($tree)[1];
    }

    /**
     * @param array<string, mixed> $tree
     * @return array{0: array<string, mixed>, 1: array<string, list<array<string, mixed>|null>>}
     */
    private static function walk(array $tree): array
    {
        $rewards = [];
        foreach (self::heldSteps($tree) as $at) {
            $reward = [];
            $tree['steps'][$at]['content'] = self::hold($tree['steps'][$at]['content'], false, $reward);
            if ($reward !== []) $rewards[$tree['steps'][$at]['id']] = $reward;
        }

        return [$tree, $rewards];
    }

    /**
     * The indexes of the steps reachable only after the primary submission.
     *
     * None where that submission is optional: a visitor who skips it reaches
     * every later step without signing up, and holding a code there would
     * take it from them.
     *
     * @param array<string, mixed> $tree
     * @return list<int>
     */
    private static function heldSteps(array $tree): array
    {
        $primary = $tree['submissions'][0] ?? null;
        $steps = $tree['steps'] ?? null;
        if (!is_array($primary) || ($primary['required'] ?? false) !== true || !is_array($steps) || !array_is_list($steps)) {
            return [];
        }
        $at = CaptureJourney::submitScreen($tree, (string) ($primary['id'] ?? ''));
        if ($at < 0) {
            return [];
        }
        if (!TemplateTree::isGraph($tree)) {
            return array_keys(array_slice($steps, $at + 1, null, true));
        }

        $graph = $tree['graph'];
        $held = [];
        foreach ($steps as $index => $step) {
            if ($index !== $at && !GraphCaptureContract::bypasses($graph, (string) $graph['entry'], (string) $steps[$at]['id'], [(string) $step['id']])) {
                $held[] = $index;
            }
        }

        return $held;
    }

    /**
     * @param array<string, mixed> $node
     * @param list<array<string, mixed>|null> $reward
     * @return array<string, mixed>
     */
    private static function hold(array $node, bool $underHidden, array &$reward): array
    {
        $hidden = $underHidden || ($node['hidden'] ?? false) === true;
        $keys = self::VALUES[$node['type'] ?? ''] ?? null;
        if ($keys !== null) {
            $reward[] = $hidden ? null : array_intersect_key($node, array_flip($keys));

            return ['hidden' => true] + array_diff_key($node, array_flip($keys));
        }
        foreach (TemplateTree::CHILD_KEYS as $key) {
            if (is_array($node[$key] ?? null)) {
                foreach ($node[$key] as $i => $child) {
                    if (is_array($child)) $node[$key][$i] = self::hold($child, $hidden, $reward);
                }
            }
        }

        return $node;
    }
}
