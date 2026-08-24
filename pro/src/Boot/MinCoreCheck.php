<?php

namespace WConvert\Pro\Boot;

defined('ABSPATH') || exit;

/**
 * Pro's min-core boot guard, as a pure comparison.
 *
 * Free and Pro release on independent tags with independent version numbers
 * (ADR 0030), so version skew between them is real by design. WCONVERT_MIN_CORE
 * is the ONE statement Pro makes about free, and this is where it is read:
 * Pro boots when the installed free version is ≥ it, and refuses otherwise.
 *
 * Nothing here touches WordPress. It takes the two versions and returns a
 * verdict, which is what makes every case the ticket named — equal, below,
 * above, malformed, free absent — assertable without an install. Reading the
 * installed version off a constant, and turning a refusal into an admin
 * notice, belong to BootGuard.
 *
 * It fails CLOSED on both sides. version_compare() never reports that it could
 * not read its input; it ranks garbage silently and does not always rank it
 * low — PHP evaluates version_compare('99 bottles', '1.4.0', '>=') as TRUE.
 * So an unreadable version on either side is a refusal, never a comparison.
 *
 * @since 0.1.0
 */
final class MinCoreCheck
{
    public static function evaluate(?string $installedCore, string $minCore): MinCoreVerdict
    {
        if ($installedCore === null) {
            return MinCoreVerdict::CoreAbsent;
        }

        if (!self::isReadableVersion($installedCore) || !self::isReadableVersion($minCore)) {
            return MinCoreVerdict::VersionUnreadable;
        }

        return version_compare($installedCore, $minCore, '>=')
            ? MinCoreVerdict::Satisfied
            : MinCoreVerdict::CoreTooOld;
    }

    /**
     * Whether a string is shaped like a version at all.
     *
     * One or more dot-separated numeric segments, optionally followed by a
     * pre-release or build suffix introduced by `-` or `+` and containing at
     * least one character. That accepts 1.4.0, 0.1.0, 8.0-beta.5 and
     * 1.4.0+build.7, and rejects a trailing separator with nothing after it.
     */
    private static function isReadableVersion(string $version): bool
    {
        return preg_match('/^\d+(\.\d+)*([-+][0-9A-Za-z.\-+]+)?$/', $version) === 1;
    }
}
