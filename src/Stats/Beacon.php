<?php

namespace WConvert\Stats;

use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * What arrived on the beacon, as events this server is willing to count.
 *
 * Pure, and separate from {@see \WConvert\Rest\BeaconController} on purpose:
 * the controller's job is the WordPress half — the headers, the rate limit,
 * the published set — and this is the half that can be exhaustively tested
 * against a body somebody made up, which is the only kind of body a public
 * unauthenticated endpoint ever receives.
 *
 * **Nothing here trusts the client to describe anything but the act.** The
 * `optin_id` is checked for shape and then checked again for membership of the
 * published set by the caller; the `kind` is matched against a closed enum;
 * the count is always one, because a client that could send a number could
 * send a large one.
 *
 * @since 0.1.0
 */
final class Beacon
{
    /**
     * How many events one request may carry.
     *
     * An honest client sends one — an Impression, immediately — or a handful
     * coalesced on `pagehide`, which is at most one Conversion and one
     * Dismissal per Optin shown on the page. Twenty is far above that and far
     * below anything worth doing on an unauthenticated request, and the excess
     * is DROPPED rather than the request refused: a batch that lost its tail
     * has still told the truth about its head.
     */
    public const MAX_EVENTS = 20;

    /** The JSON key the batch travels under. */
    public const EVENTS = 'events';

    /**
     * Parse a posted body into events worth counting.
     *
     * **De-duplicated by `(optin_id, kind)` within the request**, because that
     * is what one page view can honestly produce: the Impression is reported
     * once — the presenter's observer disconnects after the first intersection
     * — and the Conversion and the Dismissal are each one act. Two of the same
     * in one batch is a client that is either broken or lying, and neither is
     * a reason to count twice. Two SEPARATE requests still count twice, which
     * is what the rate limit is for.
     *
     * @param mixed $body
     * @return list<BeaconEvent>
     */
    public static function eventsIn($body): array
    {
        $raw = is_array($body) && is_array($body[self::EVENTS] ?? null) ? $body[self::EVENTS] : [];
        $events = [];

        foreach ($raw as $candidate) {
            if (count($events) >= self::MAX_EVENTS) {
                break;
            }

            $event = self::event($candidate);

            if ($event !== null && !isset($events[$event->key()])) {
                $events[$event->key()] = $event;
            }
        }

        return array_values($events);
    }

    /**
     * One entry of the batch, or null where it is not one.
     *
     * A malformed entry is skipped rather than fatal to the batch: the request
     * is a fire-and-forget `sendBeacon` with nobody left on the page to see a
     * response, so refusing the whole flush over one bad row would silently
     * lose the good ones.
     *
     * @param mixed $candidate
     */
    private static function event($candidate): ?BeaconEvent
    {
        if (!is_array($candidate)) {
            return null;
        }

        $optinId = $candidate['optin_id'] ?? null;
        $kind = $candidate['kind'] ?? null;

        // `Ulid::isOne()` is the ONE spelling of "this is a ULID" — the
        // alphabet, the length, and the anchoring all in one place. Three
        // callers had three copies of that pattern before it existed, and a
        // fourth here would be a shape check that drifts from the ids the
        // generator actually mints.
        if (!is_string($optinId) || !Ulid::isOne($optinId) || !is_string($kind)) {
            return null;
        }

        $stat = StatKind::fromBeacon($kind);

        return $stat === null ? null : new BeaconEvent($optinId, $stat);
    }
}
