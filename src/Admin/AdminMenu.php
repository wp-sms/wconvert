<?php

namespace WConvert\Admin;

use WConvert\Assets\ViteHelper;

defined('ABSPATH') || exit;

/**
 * The WConvert admin screen.
 *
 * One top-level menu page holding one mount node. Everything the merchant sees
 * is React, rendered from the Vite build; PHP's whole job here is to reserve
 * the page and put the bundle on it.
 *
 * @since 0.1.0
 */
final class AdminMenu
{
    public const SLUG = 'wconvert';

    private const SCRIPT_HANDLE = 'wconvert-admin';

    private string $screenId = '';

    public function hooks(): void
    {
        add_action('admin_menu', [$this, 'registerMenu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueueAssets']);
    }

    public function registerMenu(): void
    {
        $screenId = add_menu_page(
            __('WConvert', 'wconvert'),
            __('WConvert', 'wconvert'),
            'manage_options',
            self::SLUG,
            [$this, 'renderScreen'],
            'dashicons-megaphone',
            26
        );

        // false when the current user lacks the capability, in which case there
        // is no screen to match against and nothing to enqueue.
        $this->screenId = is_string($screenId) ? $screenId : '';
    }

    /**
     * The mount node, and nothing else.
     */
    public function renderScreen(): void
    {
        echo '<div class="wrap"><div id="wconvert-admin"></div></div>';
    }

    /**
     * Enqueue the admin bundle on the WConvert screen only.
     *
     * Matching on the hook suffix add_menu_page() returned rather than on a
     * hand-built string: the suffix is what admin_enqueue_scripts is passed,
     * and building it here would be a second spelling of the same fact.
     */
    public function enqueueAssets(string $hookSuffix): void
    {
        if ($this->screenId === '' || $hookSuffix !== $this->screenId) {
            return;
        }

        ViteHelper::enqueueAdmin(self::SCRIPT_HANDLE);
    }
}
