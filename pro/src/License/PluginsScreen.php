<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;

defined('ABSPATH') || exit;

/**
 * WConvert Pro's row on the Plugins screen: a License action link, and a line
 * under the row when the licence needs something — the same words and the
 * same one way forward as the header badge's reason ({@see LicenseNotice}).
 *
 * For somebody who may manage the licence only (P4), never for a managed
 * licence — an agency's client is reminded of nothing (ADR 0143, decision 9) —
 * and never on the network's Plugins screen: the licence belongs to each site,
 * and its page is in that site's admin.
 * WordPress's own update row is untouched — an update offered to this site
 * shows there, with its auto-update toggle, as for any plugin.
 *
 * @since 0.1.0
 */
final class PluginsScreen
{
    private const CAPABILITY = 'manage_options';

    public function __construct(
        private readonly PremiumServiceProvider $sdk,
        private readonly string $basename,
    ) {
    }

    public function hooks(): void
    {
        add_filter('plugin_action_links_' . $this->basename, [$this, 'actionLinks']);
        add_action('after_plugin_row_' . $this->basename, [$this, 'row'], 10, 3);
    }

    /**
     * @param array<int|string, string> $links
     * @return array<int|string, string>
     */
    public function actionLinks(array $links): array
    {
        if (!$this->speaks()) {
            return $links;
        }

        return ['license' => sprintf(
            '<a href="%s">%s</a>',
            esc_url(admin_url(AdminSurfaces::HREF)),
            esc_html__('License', 'wconvert-pro')
        )] + $links;
    }

    /**
     * The line under the row, in WordPress's own update-message markup.
     *
     * @param array<string, mixed> $data
     */
    public function row(string $file = '', array $data = [], string $status = ''): void
    {
        if (!$this->speaks()) {
            return;
        }

        $license = LicenseState::current($this->sdk);
        $notice = $license['notice'];

        if ($notice['row'] === null) {
            return;
        }

        $cta = $notice['cta'];
        $href = $cta === null ? '' : ($cta['to'] === 'page' ? admin_url(AdminSurfaces::HREF) : (string) ($license['urls'][$cta['to']] ?? ''));
        $external = $cta !== null && $cta['to'] !== 'page';
        $tone = $notice['dot'] === 'red' ? 'notice-error' : ($notice['dot'] === 'amber' ? 'notice-warning' : 'notice-info');
        $columns = isset($GLOBALS['wp_list_table']) && is_object($GLOBALS['wp_list_table']) && method_exists($GLOBALS['wp_list_table'], 'get_column_count')
            ? (int) $GLOBALS['wp_list_table']->get_column_count()
            : 4;

        printf(
            '<tr class="plugin-update-tr active wconvert-pro-license-row"><td colspan="%d" class="plugin-update colspanchange"><div class="update-message notice inline %s notice-alt"><p>%s%s</p></div></td></tr>',
            $columns,
            esc_attr($tone),
            esc_html($notice['row']),
            $href === '' || $cta === null ? '' : sprintf(
                ' <a href="%s"%s>%s%s</a>',
                esc_url($href),
                $external ? ' target="_blank" rel="noreferrer"' : '',
                esc_html($cta['label']),
                $external
                    ? ' <span aria-hidden="true">↗</span><span class="screen-reader-text"> ' . esc_html__('(opens in a new tab)', 'wconvert-pro') . '</span>'
                    : ' <span aria-hidden="true">' . (is_rtl() ? '←' : '→') . '</span>'
            )
        );
    }

    /** For a manager, on a site's own Plugins screen, about a licence that is not managed. */
    private function speaks(): bool
    {
        return current_user_can(self::CAPABILITY)
            && !is_network_admin()
            && $this->sdk->keySource()->constantKey() === null;
    }
}
