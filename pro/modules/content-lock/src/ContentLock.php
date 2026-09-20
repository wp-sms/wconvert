<?php
namespace WConvert\Pro\Module\ContentLock;

use WConvert\Assets\BuiltAsset;
use WConvert\Frontend\ContentRegion;
use WConvert\Frontend\InlineOptinBlock;

defined('ABSPATH') || exit;

final class ContentLock
{
    public static function hooks(): void
    {
        add_filter('register_block_type_args', static function (array $args, string $name): array {
            if ($name === ContentRegion::BLOCK) {
                wp_register_script('wconvert-content-lock-editor', WCONVERT_PRO_URL . 'public/blocks/content-lock.js',
                    ['wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n', InlineOptinBlock::HANDLE],
                    BuiltAsset::version(WCONVERT_PRO_DIR . 'public/blocks/content-lock.js'), true);
                wp_set_script_translations('wconvert-content-lock-editor', 'wconvert');
                $args['editor_script'] = 'wconvert-content-lock-editor';
                $args['supports']['inserter'] = true;
            }
            return $args;
        }, 10, 2);
        add_filter('wconvert_content_region_html', static function (string $html): string {
            if (is_admin() || is_feed() || is_preview() || (defined('REST_REQUEST') && REST_REQUEST)
                || !is_singular(['post', 'page']) || !in_the_loop() || !is_main_query() || post_password_required()) return $html;
            return str_replace('data-wconvert-region=', 'data-wconvert-content-lock=', $html);
        });
    }
}
