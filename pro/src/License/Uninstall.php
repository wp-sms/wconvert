<?php

namespace WConvert\Pro\License;

use Throwable;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\LicenseErrorCode;

defined('ABSPATH') || exit;

/**
 * Deleting Pro frees the seats it holds and removes what the SDK stored.
 *
 * Run from `pro/uninstall.php`, where the plugin is not loaded: only Pro's
 * constants and autoloader are, so the SDK is built here rather than resolved
 * from a container that does not exist.
 *
 * Pro refuses network activation, but it can still be activated on several
 * sites of a network, and each of those holds its own licence and seat
 * (ADR 0143). WordPress runs `uninstall.php` once, so every site is visited,
 * each inside its own `switch_to_blog()` with a fresh SDK. A port of WP
 * Statistics' `LicenseUninstaller`, budget and all: releasing waits up to 5
 * seconds a site and never throws, and once another release could take the run
 * past the budget the remaining sites are only cleaned locally — their seats
 * stay used until freed from the account, and the delete does not time out.
 *
 * Deactivating keeps the licence. Only deleting lets the seat go.
 *
 * @since 0.1.0
 */
final class Uninstall
{
    public const BUDGET_SECONDS = 20;

    /** The longest one release can wait (the SDK's own uninstall timeout). */
    private const RELEASE_SECONDS = PremiumServiceProvider::UNINSTALL_TIMEOUT;

    /**
     * @param (callable(): PremiumServiceProvider)|null $sdk Builds the SDK for
     *        the current site; a test passes its own.
     * @param (callable(): float)|null $clock
     * @return array<int, array{released: bool, removed_remotely: bool, error_code: string|null}> Per blog id.
     */
    public static function run(?callable $sdk = null, ?callable $clock = null): array
    {
        $sdk ??= [SdkConfig::class, 'sdk'];
        $clock ??= static fn (): float => microtime(true);
        $startedAt = $clock();

        if (!is_multisite()) {
            return [(int) get_current_blog_id() => self::site($sdk, $clock, $startedAt)];
        }

        $results = [];

        foreach (get_sites(['fields' => 'ids', 'number' => 0]) as $blogId) {
            switch_to_blog((int) $blogId);

            try {
                $results[(int) $blogId] = self::site($sdk, $clock, $startedAt);
            } finally {
                restore_current_blog();
            }
        }

        return $results;
    }

    /**
     * @param callable(): PremiumServiceProvider $sdk
     * @param callable(): float $clock
     * @return array{released: bool, removed_remotely: bool, error_code: string|null}
     */
    private static function site(callable $sdk, callable $clock, float $startedAt): array
    {
        // Each site's cron is its own.
        RefreshCron::unschedule();

        // Release only while a whole release still fits in the budget.
        $release = ($clock() - $startedAt) + self::RELEASE_SECONDS <= self::BUDGET_SECONDS;

        try {
            $result = $sdk()->uninstall($release);
        } catch (Throwable $e) {
            // The SDK never throws from uninstall(); building it can (a broken
            // autoloader, no sodium). The licence goes anyway, so a reinstall
            // does not inherit a seat it cannot release, and the next site and
            // the rest of Pro's uninstall still run.
            delete_option(SdkConfig::OPTION_KEY);
            delete_option(SdkConfig::OPTION_KEY . '_cipher');
            $result = ['removed_remotely' => false, 'error_code' => LicenseErrorCode::UNKNOWN];
        }

        return [
            'released' => $release,
            'removed_remotely' => (bool) ($result['removed_remotely'] ?? false),
            'error_code' => $result['error_code'] ?? null,
        ];
    }
}
