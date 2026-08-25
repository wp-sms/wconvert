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
 * surface asks — whether to render an Availability member as `locked`
 * ({@see \WConvert\Goal\Availability}).
 *
 * **An interface with one production implementation**, on the same pattern as
 * {@see \WConvert\Storage\OptionStore} and {@see \WConvert\Database\Connection}
 * and for the same reason: the fact it reports is a `define()`, and a constant
 * cannot be undefined again — so a suite that defined `WCONVERT_PRO_LOADED`
 * would decide the answer for every test that ran after it. The `locked` state
 * is the one thing a free install renders that a free install cannot reach, so
 * it has to be reachable from a test.
 *
 * It is still ONE accessor. The interface is where the question is asked;
 * {@see WpProPresence} is the only place the answer is looked up.
 *
 * @since 0.1.0
 */
interface ProPresence
{
    public function isLoaded(): bool;
}
