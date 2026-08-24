<?php

namespace WConvert\Pro\Boot;

defined('ABSPATH') || exit;

/**
 * The outcome of Pro's min-core check.
 *
 * @since 0.1.0
 */
enum MinCoreVerdict
{
    /** The installed free version meets WCONVERT_MIN_CORE. Pro may boot. */
    case Satisfied;

    /** Free is installed but older than WCONVERT_MIN_CORE. Pro must not boot. */
    case CoreTooOld;

    /** Free is not installed or not active. Pro must not boot. */
    case CoreAbsent;

    /** A version string could not be read as a version. Pro must not boot. */
    case VersionUnreadable;

    /**
     * Whether this verdict permits Pro to boot.
     *
     * Written as an allow-list of one rather than a deny-list, so a case added
     * later refuses by default. A guard whose unhandled answer is "boot" is
     * the shape of failure ADR 0015 names in WSMS's TierGate: a ladder that
     * fails open is not a ladder.
     */
    public function mayBoot(): bool
    {
        return $this === self::Satisfied;
    }
}
