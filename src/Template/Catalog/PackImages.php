<?php
namespace WConvert\Template\Catalog;

use WConvert\Template\Transfer\DesignImages;

defined('ABSPATH') || exit;

/**
 * Image bindings are separate from inert design trees. Only verified local URLs enter runtime trees.
 *
 * A binding names a picture slot by its path ({@see DesignImages}): an image's
 * `src`, or a `bg-image` in design, node or `narrow` tokens, the same slots
 * merchant transfer uses (ADR 0162). A slot is bound only where the design
 * leaves it empty, and only once.
 */
final class PackImages
{
    /** @param array<string, mixed> $pack */
    public static function validate(array $pack): void
    {
        $bindings = $pack['image_bindings'] ?? [];
        PackValidator::check(is_array($bindings) && array_is_list($bindings) && count($bindings) <= 96, __('Invalid image bindings.', 'wconvert'));
        if ($pack['assets'] !== []) PackValidator::check(in_array('pack-images:1', $pack['requires']['capabilities'], true), __('This pack does not declare image support.', 'wconvert'));
        $assets = array_column($pack['assets'], null, 'id'); $templates = array_column($pack['templates'], null, 'id'); $slots = []; $used = [];
        foreach ($bindings as $binding) {
            PackValidator::check(is_array($binding), __('Invalid image binding.', 'wconvert'));
            PackValidator::keys($binding, ['template_id', 'slot', 'asset_id']);
            foreach (['template_id', 'asset_id'] as $key) PackValidator::check(PackValidator::identifier($binding[$key] ?? null), __('Invalid image binding.', 'wconvert'));
            PackValidator::check(is_string($binding['slot'] ?? null) && isset($templates[$binding['template_id']]), __('Invalid image binding.', 'wconvert'));
            $template = $templates[$binding['template_id']];
            $slots[$template['id']] ??= DesignImages::slots(self::design($template));
            $slot = $slots[$template['id']][$binding['slot']] ?? null;
            $target = $template['id'] . ':' . $binding['slot'];
            PackValidator::check($slot !== null && $slot['url'] === '' && isset($assets[$binding['asset_id']]) && !isset($used[$target]), __('Image binding is missing or repeated.', 'wconvert'));
            PackValidator::check($template['tier'] !== 'free' || $assets[$binding['asset_id']]['access'] === 'free', __('Free designs cannot reference premium images.', 'wconvert'));
            $used[$target] = true;
        }
        PackValidator::check(array_diff(array_keys($assets), array_column($bindings, 'asset_id')) === [], __('This pack contains unused images.', 'wconvert'));
    }

    /** @param array<string, mixed> $pack
     * @param array<string, string> $urls
     * @return array<string, mixed> */
    public static function hydrate(array $pack, array $urls): array
    {
        foreach ($pack['image_bindings'] ?? [] as $binding) PackValidator::check(isset($urls[$binding['asset_id']]), __('Required pack images are missing.', 'wconvert'));
        foreach ($pack['templates'] as &$template) {
            $design = self::design($template);
            $slots = DesignImages::slots($design);
            foreach ($pack['image_bindings'] ?? [] as $binding) {
                if ($binding['template_id'] !== $template['id']) continue;
                $slot = $slots[$binding['slot']];
                $url = $urls[$binding['asset_id']];
                DesignImages::put($design, $slot['path'], $slot['background'] ? 'url("' . $url . '")' : $url);
            }
            $template['tree'] = $design['tree'];
            $template['tokens'] = $design['tokens'];
        }
        return $pack;
    }

    /** The part of a template that holds pictures, so slot paths start at `tree` or `tokens`.
     * @param array<string, mixed> $template
     * @return array{tree: mixed, tokens: mixed} */
    private static function design(array $template): array
    {
        return ['tree' => $template['tree'], 'tokens' => $template['tokens'] ?? []];
    }
}
