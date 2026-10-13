<?php

namespace WConvert\Admin;

use WConvert\Support\Docs;

defined('ABSPATH') || exit;

/**
 * Docs and Support under a WConvert row on the Plugins screen (ADR 0145),
 * where WordPress puts "View details": the first place someone looks when the
 * plugin is installed and they do not yet know where to start.
 *
 * Plain links to wconvert.io in a new tab. Pro adds the same pair to its own
 * row with its own basename.
 *
 * @since 1.0.0
 */
final class PluginRowMeta
{
    public function __construct(private readonly string $basename)
    {
    }

    public function hooks(): void
    {
        add_filter('plugin_row_meta', [$this, 'links'], 10, 2);
    }

    /**
     * @param mixed $meta
     * @param mixed $file
     * @return array<int|string, mixed>
     */
    public function links($meta, $file): array
    {
        $meta = is_array($meta) ? $meta : [];

        if ($file !== $this->basename) {
            return $meta;
        }

        $link = static fn (string $url, string $label): string => sprintf(
            '<a href="%1$s" target="_blank" rel="noreferrer">%2$s<span class="screen-reader-text"> %3$s</span></a>',
            esc_url($url),
            esc_html($label),
            esc_html__('(opens in a new tab)', 'wconvert')
        );

        return $meta + [
            'wconvert-docs' => $link(Docs::url(), __('Docs', 'wconvert')),
            'wconvert-support' => $link(Docs::SUPPORT, __('Support', 'wconvert')),
        ];
    }
}
