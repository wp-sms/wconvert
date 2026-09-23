<?php

namespace WConvert\Stats;

defined('ABSPATH') || exit;

/**
 * One act a browser reported: which [[Optin]], and what kind.
 *
 * **Two fields, and there is nothing else to add.** The beacon is stateless —
 * no visitor id cookie, no device id, no hashed fingerprint, and no identifier
 * of any kind on the wire (ADR 0017) — so what is lost is unique visitors, and
 * "3 impressions" becoming indistinguishable from "1 visitor who saw it 3
 * times". That is the right trade for a free wp.org plugin: the alternative
 * buys one secondary metric with a persistent identifier on every install in
 * the EU, and with it a retention obligation, an export surface and an erasure
 * surface for a value that identifies a browser rather than a person.
 *
 * There is no timestamp either. The day is stamped at the boundary from the
 * SERVER's clock ({@see StatDay}), because a client-supplied date on a public
 * endpoint is a date anyone can choose.
 *
 * @since 0.1.0
 */
final class BeaconEvent
{
    public function __construct(
        public readonly string $optinId,
        public readonly StatKind $kind,
        public readonly string $scope = '',
    ) {
    }

    /** How this event de-duplicates within one batch. */
    public function key(): string
    {
        return $this->optinId . '|' . $this->kind->value . '|' . $this->scope;
    }
}
