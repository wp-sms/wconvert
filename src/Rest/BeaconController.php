<?php

namespace WConvert\Rest;

use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Stats\Beacon;
use WConvert\Stats\BeaconTraffic;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatsRepository;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * The beacon: an [[Impression]], a [[Conversion]] or a [[Dismissal]] happened,
 * and a daily counter goes up by one.
 *
 * **The second public route WConvert exposes, and the last.** It is public and
 * unauthenticated by necessity — the page it fires from is served
 * byte-identically to every visitor by the full-page cache, so a nonce baked
 * into it is the same nonce for everyone for the cache's lifetime (ADR 0004).
 *
 * **It is stateless, so there is no consent gate on it at all.** No visitor id,
 * no device id, no hashed fingerprint, no dedup key (ADR 0017) — and nothing a
 * consent gate would be protecting. What that costs is unique visitors, and
 * "3 impressions" becoming indistinguishable from "1 visitor who saw it 3
 * times".
 *
 * **The hardening is light and deliberate, and this is the whole of it**
 * (ADR 0019):
 *
 * - prefetch, prerender and bot traffic is dropped, with no heuristics
 *   ({@see BeaconTraffic});
 * - the IP is hashed into a short-lived transient as a rate limit, and stored
 *   nowhere ({@see RateLimit});
 * - the `optin_id` is validated against the published set — the same check the
 *   capture endpoint makes, for a related reason: a count attributed to an
 *   Optin the report-time join cannot interpret is worse than no count
 *   (ADR 0020).
 *
 * It stops there. What abuse costs is a wrong number on one merchant's
 * dashboard, not data loss and not a breach — and the price of the counter
 * shape is that a wrong number can never be recomputed, which is a reason to
 * count carefully rather than to authenticate impossibly.
 *
 * **This class is wiring, and the parts it wires are what the unit suite
 * exercises.** The route end to end — headers, permission callback, dispatch,
 * and a real row in a real table — is proven by `bin/verify-stats.php` through
 * `rest_do_request()`, because a `WP_REST_Request` faithful enough to prove
 * anything is a WordPress install with extra steps.
 *
 * @since 0.1.0
 */
final class BeaconController
{
    public function __construct(
        private readonly PublishedSet $publishedSet,
        private readonly StatsRepository $stats,
        private readonly RateLimit $rateLimit,
        private readonly Degradation $degradation,
    ) {
    }

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/beacon', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'record'],
                'permission_callback' => [Routes::class, 'canBeacon'],
                // Nothing declared, and nothing to declare: every field of the
                // body is checked by {@see Beacon} against a closed enum or a
                // ULID pattern, which is stricter than anything
                // `rest_sanitize_value_from_schema` would do to it — and a
                // declared schema that coerces is how a value stops meaning
                // what the client sent (ADR 0032).
                'args' => [],
            ],
        ]);
    }

    /**
     * Count what arrived — or count nothing, and say so the same way.
     *
     * **204 for everything that is not rate-limited**, including a batch where
     * every event was dropped. There is nobody on the page to read a response:
     * this arrives through `navigator.sendBeacon` during `pagehide`, which
     * discards the response entirely and cannot retry. A 404 for an unpublished
     * Optin would be a status nothing reads, describing a condition the client
     * cannot fix, about a request the client has already forgotten.
     *
     * 429 is the exception, and it is honest rather than useful for the same
     * reason: it is the one refusal a caller sending traffic on purpose might
     * be watching for.
     */
    public function record(WP_REST_Request $request): WP_REST_Response
    {
        $countable = BeaconTraffic::countable(
            (string) $request->get_header('sec-purpose'),
            (string) $request->get_header('purpose'),
            (string) $request->get_header('user-agent')
        );

        if (!$countable) {
            return new WP_REST_Response(null, 204);
        }

        // `REMOTE_ADDR` and no forwarded header. `X-Forwarded-For` is
        // client-settable on any install not behind a proxy that overwrites
        // it, so a limit keyed on it is keyed on a value the rate-limited party
        // chooses. Behind a reverse proxy this buckets a whole site's visitors
        // together, which is why {@see RateLimit}'s ceiling is generous.
        //
        // `wp_unslash()` because WordPress adds slashes to every superglobal on
        // load. Unescaped, an address carrying one would hash to a different
        // bucket than the same address without — which is a rate limit with a
        // hole in it rather than a display bug.
        $address = (string) wp_unslash($_SERVER['REMOTE_ADDR'] ?? '');

        // The clock is READ HERE and passed down, the same way the day is —
        // neither {@see RateLimit} nor {@see StatsRepository} owns one, so
        // neither has anything to stub.
        if (!$this->rateLimit->allows($address, time())) {
            return new WP_REST_Response(null, 429);
        }

        // The set is parsed ONCE, into ids. Asking `PublishedOptin::findInSet()`
        // per event would parse the whole set — building a `Targeting` and a
        // payload for every entry — once for each of up to twenty events, and
        // throw all of it away for an id comparison. That is the right shape for
        // the capture route, which asks about exactly one id; it is the wrong
        // one here.
        //
        // **And a [[Suspended]] Optin is not in it**, which is why this asks
        // for the SERVED ids rather than the published ones: ADR 0027 wants
        // no rows rather than zero-valued ones, and a page cached before the
        // dependency went away still carries the entry and still beacons.
        //
        // The capture route deliberately does NOT ask the same question. A
        // [[Lead]] somebody actually typed is the one genuinely unrecoverable
        // loss available here, and the [[Lead]] log is not where a
        // [[Conversion]] is counted (ADR 0019).
        $published = PublishedOptin::servableIdsIn($this->publishedSet->all(), $this->degradation);

        // Asked once for the whole batch. The events were coalesced over one
        // page view, so they belong to one moment — and a flush that straddles
        // midnight landing half on each day would be a worse answer than either
        // day alone.
        $today = StatDay::today();

        foreach (Beacon::eventsIn($request->get_json_params()) as $event) {
            // The same membership check the capture endpoint makes. An Optin
            // that is not in the published set has no rendered form and no
            // Impression this server ever served, and a count against it names
            // an Optin the report-time join cannot interpret (ADR 0020).
            if (!isset($published[$event->optinId])) {
                continue;
            }

            $this->stats->increment($event->optinId, $event->kind, $today);
        }

        return new WP_REST_Response(null, 204);
    }
}
