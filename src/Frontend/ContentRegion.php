<?php
namespace WConvert\Frontend;

defined('ABSPATH') || exit;

/** Readable saved-content fallback. Pro supplies authoring and gating. */
final class ContentRegion
{
    public const BLOCK = 'wconvert/content-lock';
    public const SHORTCODE = 'wconvert_content_lock';

    public static function register(): void
    {
        register_block_type(self::BLOCK, [
            'api_version' => version_compare((string) get_bloginfo('version'), '6.3', '>=') ? 3 : 2,
            'title' => __('WConvert Content lock', 'wconvert'),
            'category' => 'widgets',
            'attributes' => ['optinId' => ['type' => 'string', 'default' => '']],
            'supports' => ['html' => false, 'inserter' => false],
            'render_callback' => static fn (array $attributes, string $content): string => self::html((string) ($attributes['optinId'] ?? ''), $content),
        ]);
        add_shortcode(self::SHORTCODE, [self::class, 'shortcode']);
    }

    /** @param array<string, string>|string $attributes */
    public static function shortcode($attributes, ?string $content = null): string
    {
        $content ??= '';
        // Nested wrappers and oversized shortcode regions stay readable.
        if (strlen($content) > 1048576 || str_contains($content, '[' . self::SHORTCODE)) {
            return $content;
        }
        return self::html(is_array($attributes) ? (string) ($attributes['id'] ?? '') : '', do_shortcode($content));
    }

    public static function html(string $id, string $content): string
    {
        $anchor = InlineAnchor::html($id);
        if ($anchor === '') return $content;
        $markup = '<div data-wconvert-region="' . esc_attr($id) . '">' . $anchor
            . '<div class="wconvert-content-region" data-wconvert-locked-content>' . $content . '</div></div>';
        return (string) apply_filters('wconvert_content_region_html', $markup);
    }
}
