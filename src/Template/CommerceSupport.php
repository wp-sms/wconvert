<?php
namespace WConvert\Template;
defined('ABSPATH') || exit;
/** Capability and design usage; the implementation is supplied only by Pro. */
final class CommerceSupport
{
    /** Direct cart actions require the commerce module; ordinary quiz links do not.
     * @param array<string, mixed> $tree */
    public static function quizAdditions(array $tree): bool
    {
        foreach ($tree['steps'] ?? [] as $screen) foreach ($screen['results'] ?? [] as $result) {
            if (isset($result['product_action']) && $result['product_action'] !== 'link') return true;
        }
        return false;
    }
    public static function active(): bool { return (bool) apply_filters('wconvert_commerce', false); }
    /** @param array<string, mixed> $tree */
    public static function used(array $tree): bool
    {
        foreach ($tree['steps'] ?? [] as $step) foreach (CaptureJourney::nodes($step['content'] ?? []) as $node) {
            if (($node['type'] ?? '') === 'products') return true;
        }
        return false;
    }
}
