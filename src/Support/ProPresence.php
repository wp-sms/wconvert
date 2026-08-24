<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * The one accessor for "is Pro loaded" (ADR 0015).
 *
 * It exists from day one as headroom for a future tier ladder, not as a gate.
 * Nothing in WConvert asks it in order to REFUSE a premium capability: a
 * premium capability is absent from a free install rather than present and
 * guarded, so there is nothing to guard. What this answers is the question a
 * surface asks — whether to render an Availability member as `locked`.
 *
 * The answer is possession, never a licence. WCONVERT_PRO_LOADED is defined by
 * Pro's bootstrap and only after Pro's min-core guard passed, so a Pro that
 * refused to boot reads here exactly as a Pro that is not installed — which is
 * what the merchant is in fact getting.
 *
 * WSMS's cautionary case: its shipped elite ZIP is missing the tiers.json its
 * own TierGate reads, benign only because every lookup fails open. There is no
 * file to be missing here.
 *
 * @since 0.1.0
 */
final class ProPresence
{
    public function isLoaded(): bool
    {
        return defined('WCONVERT_PRO_LOADED');
    }
}
