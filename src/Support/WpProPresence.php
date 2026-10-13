<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Whether [[Pro]] is loaded — which, with one paid tier, is which tier is
 * installed.
 *
 * `WCONVERT_PRO_LOADED` is defined by Pro's bootstrap and only after its
 * min-core guard passed, so a Pro that refused to boot reads here exactly as a
 * Pro that is not installed — which is what the merchant is in fact getting
 * (ADR 0015). **Not a licence**: the answer is a fact about what is on disk and
 * running, never about what a server says.
 *
 * This used to infer one of three paid rungs from the module directories the
 * build shipped (ADR 0056). There is one Pro now and it ships every module
 * (ADR 0146), so a loaded Pro is {@see Tier::Pro} and nothing is scanned.
 * Possession is still the gate: a module whose files went missing after the
 * build registers nothing, whatever this answers.
 *
 * @since 0.1.0
 */
final class WpProPresence implements ProPresence
{
    public function installedTier(): Tier
    {
        return defined('WCONVERT_PRO_LOADED') ? Tier::Pro : Tier::Free;
    }
}
