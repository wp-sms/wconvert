<?php

namespace WConvert\Pro\Boot;

defined('ABSPATH') || exit;

/**
 * The WordPress side of Pro's min-core guard.
 *
 * MinCoreCheck does the comparison and knows nothing of WordPress. This reads
 * the installed free version off the constant free defines, and turns a
 * refusal into an admin notice that names its cause.
 *
 * @since 0.1.0
 */
final class BootGuard
{
    /**
     * Compare the installed free version against this build's WCONVERT_MIN_CORE.
     *
     * Free defines WCONVERT_VERSION at file scope, which happens before any
     * `plugins_loaded` callback whatever order WordPress loads the two plugins
     * in. So the constant being undefined here means free is genuinely absent
     * or inactive, never that Pro simply looked too early.
     */
    public static function verdict(): MinCoreVerdict
    {
        return MinCoreCheck::evaluate(self::installedCore(), (string) WCONVERT_MIN_CORE);
    }

    /**
     * The installed free version, or null when free is not there at all.
     */
    private static function installedCore(): ?string
    {
        return defined('WCONVERT_VERSION') ? (string) WCONVERT_VERSION : null;
    }

    /**
     * Queue the admin notice explaining a refusal.
     *
     * A Pro that quietly does nothing is indistinguishable from a Pro that is
     * working, so the merchant would read the missing premium features as a
     * bug in the product rather than as something they can fix.
     *
     * The message is built INSIDE the callback, not here. This runs on
     * `plugins_loaded`, and calling __() that early makes WordPress load a
     * text domain before `init` — which since 6.7 emits a
     * `_load_textdomain_just_in_time` notice. That notice is not cosmetic: with
     * WP_DEBUG_DISPLAY on it prints during `plugins_loaded`, so headers go out
     * before anything that needs to set one, and the request breaks in ways
     * that have nothing to do with WConvert. `admin_notices` fires long after
     * `init`, where the same __() calls are simply correct — and where the
     * refusal actually gets translated, which it never did here, because this
     * path is the one that returns before the text domain is loaded.
     */
    public static function noticeRefusal(MinCoreVerdict $verdict): void
    {
        if ($verdict->mayBoot()) {
            return;
        }

        add_action('admin_notices', static function () use ($verdict): void {
            printf('<div class="notice notice-error"><p>%s</p></div>', esc_html(self::refusalMessage($verdict)));
        });
    }

    /**
     * The message for a refusal, naming its cause.
     *
     * Each verdict gets its own wording because each has a different fix.
     * "Update WConvert" is useless advice to someone who has not installed it,
     * and "install WConvert" is baffling to someone looking at it in their
     * plugin list.
     */
    public static function refusalMessage(MinCoreVerdict $verdict): string
    {
        return match ($verdict) {
            MinCoreVerdict::CoreAbsent => __(
                'WConvert Pro did not start: it supplies features to the WConvert plugin, and WConvert is not active. Activate WConvert.',
                'wconvert-pro'
            ),
            MinCoreVerdict::CoreTooOld => sprintf(
                /* translators: 1: required WConvert version, 2: installed WConvert version. */
                __(
                    'WConvert Pro did not start: it needs WConvert %1$s or newer, and this site has %2$s. Update WConvert.',
                    'wconvert-pro'
                ),
                (string) WCONVERT_MIN_CORE,
                self::installedCore() ?? ''
            ),
            MinCoreVerdict::VersionUnreadable => sprintf(
                /* translators: 1: installed WConvert version string, 2: version WConvert Pro requires. */
                __(
                    'WConvert Pro did not start: it could not read the versions it compares. WConvert reports "%1$s" and WConvert Pro requires "%2$s". Reinstall both plugins.',
                    'wconvert-pro'
                ),
                self::installedCore() ?? '',
                (string) WCONVERT_MIN_CORE
            ),
            MinCoreVerdict::Satisfied => '',
        };
    }
}
