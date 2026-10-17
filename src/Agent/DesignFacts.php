<?php

namespace WConvert\Agent;

use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/** What a design's tree holds that changes what a campaign on it needs. */
final class DesignFacts
{
    /**
     * @param mixed $tree
     * @return array{has_link_button: bool, has_countdown: bool, has_code: bool}
     */
    public static function of(mixed $tree): array
    {
        $facts = ['has_link_button' => false, 'has_countdown' => false, 'has_code' => false];
        if (!is_array($tree)) return $facts;
        TemplateTree::rewrittenIn(['template' => ['tree' => $tree]], static function (array $node) use (&$facts): array {
            $type = $node['type'] ?? null;
            if ($type === 'button' && ($node['action'] ?? null) === 'link') $facts['has_link_button'] = true;
            if ($type === 'countdown') $facts['has_countdown'] = true;
            if ($type === 'code') $facts['has_code'] = true;
            return $node;
        });
        return $facts;
    }
}
