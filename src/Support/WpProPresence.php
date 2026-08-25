<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * "Is Pro loaded", answered by the constant Pro's bootstrap defines.
 *
 * The answer is possession, never a licence. `WCONVERT_PRO_LOADED` is defined
 * by Pro's bootstrap and only after Pro's min-core guard passed, so a Pro that
 * refused to boot reads here exactly as a Pro that is not installed — which is
 * what the merchant is in fact getting (ADR 0015).
 *
 * WSMS's cautionary case: its shipped elite ZIP is missing the tiers.json its
 * own TierGate reads, benign only because every lookup fails open. There is no
 * file to be missing here.
 *
 * @since 0.1.0
 */
final class WpProPresence implements ProPresence
{
    public function isLoaded(): bool
    {
        return defined('WCONVERT_PRO_LOADED');
    }
}
