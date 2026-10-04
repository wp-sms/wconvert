<?php
namespace WConvert\Template;
defined('ABSPATH') || exit;
/** Capability and design usage; the implementation is supplied only by Pro. */
final class CommerceSupport
{
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
