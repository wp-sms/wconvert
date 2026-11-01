<?php

namespace WConvert\Onboarding;

defined('ABSPATH') || exit;

/**
 * After activation, take the person who activated WConvert to Campaigns once,
 * where the getting-started checklist is waiting (ADR 0176).
 *
 * Activation sets a short transient. WordPress then sends the browser to
 * `plugins.php?activate=true`, and that one page load redirects. The
 * transient is read only on `plugins.php`, so no other admin page pays for
 * the check.
 *
 * **No redirect** for a bulk or network activation, WP-CLI, AJAX, someone
 * who can't manage options, or a site that already has a campaign (a
 * reactivation).
 */
final class FirstRunRedirect
{
    public const TRANSIENT = 'wconvert_activation_redirect';

    /** Long enough to reach the next page load, short enough to forget. */
    public const TTL = 60;

    /**
     * @param \Closure(): bool $hasCampaigns
     * @param ?\Closure(string): void $go Defaults to wp_safe_redirect() and exit.
     */
    public function __construct(
        private readonly \Closure $hasCampaigns,
        private readonly ?\Closure $go = null,
    ) {
    }

    /**
     * Called from {@see \WConvert\Bootstrap::activate()}.
     *
     * @param array<string, mixed> $request `$_REQUEST`, passed in for tests.
     */
    public static function arm(bool $networkWide, array $request): void
    {
        $bulk = ($request['action'] ?? null) === 'activate-selected'
            && is_array($request['checked'] ?? null) && count($request['checked']) > 1;

        if ($networkWide || $bulk || self::cli()) {
            return;
        }

        set_transient(self::TRANSIENT, 1, self::TTL);
    }

    public function hooks(): void
    {
        add_action('admin_init', [$this, 'maybeRedirect']);
    }

    public function maybeRedirect(): void
    {
        if (($GLOBALS['pagenow'] ?? '') !== 'plugins.php' || get_transient(self::TRANSIENT) === false) {
            return;
        }

        // Spent whatever happens next: this is a one-time offer.
        delete_transient(self::TRANSIENT);

        $go = self::decide([
            // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only, WordPress's own redirect flag.
            'bulk' => isset($_GET['activate-multi']),
            'ajax' => wp_doing_ajax(),
            'cli' => self::cli(),
            'network' => is_network_admin(),
            'capable' => current_user_can('manage_options'),
            'has_campaigns' => ($this->hasCampaigns)(),
        ]);

        if (!$go) {
            return;
        }

        $target = admin_url('admin.php?page=wconvert');

        if ($this->go !== null) {
            ($this->go)($target);

            return;
        }

        wp_safe_redirect($target);
        exit;
    }

    /**
     * @param array{bulk: bool, ajax: bool, cli: bool, network: bool, capable: bool, has_campaigns: bool} $facts
     */
    public static function decide(array $facts): bool
    {
        return !$facts['bulk'] && !$facts['ajax'] && !$facts['cli'] && !$facts['network']
            && $facts['capable'] && !$facts['has_campaigns'];
    }

    private static function cli(): bool
    {
        return defined('WP_CLI') && WP_CLI;
    }
}
