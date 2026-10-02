<?php
namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

/** Image bindings are separate from inert design trees. Only verified local URLs enter runtime trees. */
final class PackImages
{
    /** @param array<string, mixed> $pack */
    public static function validate(array $pack): void
    {
        $bindings = $pack['image_bindings'] ?? [];
        PackValidator::check(is_array($bindings) && array_is_list($bindings) && count($bindings) <= 96, __('Invalid image bindings.', 'wconvert'));
        if ($pack['assets'] !== []) PackValidator::check(in_array('pack-images:1', $pack['requires']['capabilities'], true), __('This pack does not declare image support.', 'wconvert'));
        $assets = array_column($pack['assets'], null, 'id'); $targets = []; $used = [];
        foreach ($pack['templates'] as $template) foreach ($template['tree']['steps'] as $step) {
            self::walk($step['content'], static function (array $node) use (&$targets, $template): array {
                if (($node['type'] ?? '') === 'image') $targets[$template['id'] . ':' . $node['id']] = $template['tier'];
                return $node;
            });
        }
        foreach ($bindings as $binding) {
            PackValidator::check(is_array($binding), __('Invalid image binding.', 'wconvert'));
            PackValidator::keys($binding, ['template_id', 'node_id', 'asset_id']);
            foreach (['template_id', 'node_id', 'asset_id'] as $key) PackValidator::check(PackValidator::identifier($binding[$key] ?? null), __('Invalid image binding.', 'wconvert'));
            $target = $binding['template_id'] . ':' . $binding['node_id'];
            PackValidator::check(isset($targets[$target], $assets[$binding['asset_id']]) && !isset($used[$target]), __('Image binding is missing or repeated.', 'wconvert'));
            PackValidator::check($targets[$target] !== 'free' || $assets[$binding['asset_id']]['access'] === 'free', __('Free designs cannot reference premium images.', 'wconvert'));
            $used[$target] = true;
        }
        PackValidator::check(array_diff(array_keys($assets), array_column($bindings, 'asset_id')) === [], __('This pack contains unused images.', 'wconvert'));
    }

    /** @param array<string, mixed> $pack
     * @param array<string, string> $urls
     * @return array<string, mixed> */
    public static function hydrate(array $pack, array $urls): array
    {
        $bindings = [];
        foreach ($pack['image_bindings'] ?? [] as $binding) {
            PackValidator::check(isset($urls[$binding['asset_id']]), __('Required pack images are missing.', 'wconvert'));
            $bindings[$binding['template_id']][$binding['node_id']] = $urls[$binding['asset_id']];
        }
        foreach ($pack['templates'] as &$template) foreach ($template['tree']['steps'] as &$step) {
            $step['content'] = self::walk($step['content'], static function (array $node) use ($bindings, $template): array {
                if (isset($bindings[$template['id']][$node['id'] ?? ''])) $node['src'] = $bindings[$template['id']][$node['id']];
                return $node;
            });
        }
        return $pack;
    }

    /** @param array<string, mixed> $node
     * @param callable(array<string, mixed>): array<string, mixed> $visit
     * @return array<string, mixed> */
    private static function walk(array $node, callable $visit): array
    {
        foreach (['children', 'start', 'end'] as $key) if (isset($node[$key])) $node[$key] = array_map(static fn (array $child): array => self::walk($child, $visit), $node[$key]);
        return $visit($node);
    }
}
