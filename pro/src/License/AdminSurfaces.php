<?php

namespace WConvert\Pro\License;

use WConvert\Admin\AdminMenu;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;

defined('ABSPATH') || exit;

/**
 * Where the licence shows up in wp-admin, outside its own page.
 *
 * **No nav tab** (ADR 0143, decision 7): a licence is looked at a few times a
 * year. Two doors lead to it instead, both to `#license` on the one WConvert
 * page — a WordPress submenu, WConvert → License, and the plan badge in the
 * header, which carries the dot.
 *
 * Everything here is for somebody who may manage the licence (P4). The
 * WConvert screen itself needs `manage_options` today, so the badge check
 * repeats it on purpose: the filter must stay safe if that ever changes.
 *
 * @since 0.1.0
 */
final class AdminSurfaces
{
    /** The License page, as free's one admin page with a hash. */
    public const HREF = 'admin.php?page=' . AdminMenu::SLUG . '#license';

    private const CAPABILITY = 'manage_options';

    public function __construct(private readonly PremiumServiceProvider $sdk)
    {
    }

    public function hooks(): void
    {
        // After free's own `admin_menu` at 10, which registers the top level.
        add_action('admin_menu', [$this, 'registerSubmenu'], 11);
        add_filter('wconvert_pro_admin_settings', [$this, 'withPlanBadge']);
    }

    /**
     * WConvert → Campaigns, then WConvert → License.
     *
     * The first entry repeats the top level's slug, which is how WordPress
     * renames the submenu's automatic first item: without it the list would
     * open on a second "WConvert". The License entry's slug is a URL, so
     * WordPress links it as written — the same page, at `#license`. Both
     * entries are one page, so which is `current` is decided in the browser
     * from the hash.
     */
    public function registerSubmenu(): void
    {
        add_submenu_page(AdminMenu::SLUG, __('Campaigns', 'wconvert-pro'), __('Campaigns', 'wconvert-pro'), self::CAPABILITY, AdminMenu::SLUG);
        add_submenu_page(AdminMenu::SLUG, __('License', 'wconvert-pro'), __('License', 'wconvert-pro'), self::CAPABILITY, self::HREF);
    }

    /**
     * The header badge, as data beside the admin bundle: where it goes, its
     * dot and why. Nothing for somebody who cannot manage the licence.
     *
     * @param array<string, mixed> $settings
     * @return array<string, mixed>
     */
    public function withPlanBadge(array $settings): array
    {
        if (!current_user_can(self::CAPABILITY)) {
            return $settings;
        }

        $license = LicenseState::current($this->sdk);

        return $settings + ['planBadge' => self::badge($license)];
    }

    /**
     * The badge as free's header draws it, which knows nothing of licences:
     * where it links, the words when they are not the plan's name, whether it
     * is a prompt, and its dot and the dot's reason.
     *
     * @param array<string, mixed> $license {@see LicenseState::current()}
     * @return array{href: string, label: string|null, prompt: bool, tone: string|null, reason: string|null, hint: string}
     */
    public static function badge(array $license): array
    {
        $notice = $license['notice'];
        // A managed licence that never activated is the agency's to fix, not
        // a merchant's to be asked to.
        $prompt = $license['state'] === 'none' && $license['managed'] === null;

        return [
            'href' => '#license',
            'label' => $prompt ? __('Activate Pro', 'wconvert-pro') : null,
            'prompt' => $prompt,
            'tone' => $notice['dot'],
            'reason' => $notice['dot'] !== null ? $notice['title'] : null,
            // Where the link goes, for a badge with nothing to report: a link
            // named only "Pro" does not say it opens the licence.
            'hint' => __('License', 'wconvert-pro'),
        ];
    }
}
