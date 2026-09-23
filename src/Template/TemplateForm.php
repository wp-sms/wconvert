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
        return CaptureJourney::issue($tree);
    }

    /** @param array<string, mixed> $node */
    public static function submits(array $node): bool
    {
        if (($node['type'] ?? null) === 'button') {
            return ($node['action'] ?? null) === 'submit';
        }

        foreach (TemplateTree::childrenOf($node) as $child) {
            if (is_array($child) && self::submits($child)) {
                return true;
            }
        }

        return false;
    }
}
