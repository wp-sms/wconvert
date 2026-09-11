<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** The submitting step and the minimum structure a published form needs. */
final class TemplateForm
{
    /**
     * A normalized draft may be incomplete; publication needs a usable form.
     *
     * @param mixed $template
     */
    public static function issue($template): ?string
    {
        $tree = is_array($template) && is_array($template['tree'] ?? null) ? $template['tree'] : [];
        $steps = is_array($tree['steps'] ?? null) ? $tree['steps'] : [];
        foreach ($steps as $step) {
            if (!is_array($step) || !self::submits($step)) {
                continue;
            }
            $fields = [];
            /** @param array<string, mixed> $node */
            $walk = static function (array $node) use (&$walk, &$fields): void {
                if (($node['hidden'] ?? false) === true) {
                    return;
                }
                if (($node['type'] ?? null) === 'field' && is_string($node['name'] ?? null)) {
                    $fields[$node['name']] = $node;
                }
                foreach (TemplateTree::childrenOf($node) as $child) {
                    if (is_array($child)) {
                        $walk($child);
                    }
                }
            };
            $walk($step);
            if (!isset($fields['email']) && !isset($fields['phone'])) {
                return 'identifier';
            }
            if (isset($fields['interest']) && empty($fields['interest']['options'])) {
                return 'choices';
            }
        }
        return null;
    }

    /** @param array<string, mixed> $node */
    public static function submits(array $node): bool
    {
        if (($node['type'] ?? null) === 'button') {
            return ($node['action'] ?? null) !== 'link';
        }

        foreach (TemplateTree::childrenOf($node) as $child) {
            if (is_array($child) && self::submits($child)) {
                return true;
            }
        }

        return false;
    }
}
