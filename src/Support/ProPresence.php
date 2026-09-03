<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * The one accessor for **which tier is installed** (ADR 0015).
 *
 * It exists as the tier ladder rather than as a gate. Nothing in WConvert asks
 * it in order to REFUSE a premium capability: a premium capability is absent
 * from an install that did not buy it rather than present and guarded, so
 * there is nothing to guard. What this answers is the question a surface
 * asks — whether to render an Availability member as `locked`
 * ({@see Availability}) and, when it is locked, which tier to name.
 *
 * =============================================================================
 * IT WAS `isLoaded(): bool`, AND A BOOLEAN HAD NOWHERE TO PUT A THIRD TIER.
 * =============================================================================
 * ADR 0015 always described this as "headroom for a future tier ladder"; it was
 * a boolean, so the headroom was rhetorical. {@see Availability::of()} takes a
 * three-valued question and could only be handed a two-valued answer, and every
 * `tier:` declaration in the product could only mean "not free".
 *
 * The answer is now a {@see Tier}, and a free install answers {@see Tier::Free}
 * rather than `false` — which is the same sentence CONTEXT.md already made
 * about the product: a free install is not a crippled Pro install, it is the
 * whole product minus features it never carried.
 *
 * **An interface with one production implementation**, on the same pattern as
 * {@see \WConvert\Storage\OptionStore} and {@see \WConvert\Database\Connection}
 * and for the same reason: what it reports depends on a `define()` and on the
 * contents of another plugin's directory, and a suite cannot undefine a
 * constant or install a plugin. The `locked` state is the one thing a free
 * install renders that a free install cannot reach, so it has to be reachable
 * from a test.
 *
 * It is still ONE accessor. The interface is where the question is asked;
 * {@see WpProPresence} is the only place the answer is looked up.
 *
 * @since 0.1.0
 */
interface ProPresence
{
    /**
     * The tier this install is running at — {@see Tier::Free} where [[Pro]] is
     * absent, refused its min-core guard, or shipped nothing this build can
     * recognise.
     */
    public function installedTier(): Tier;
}
