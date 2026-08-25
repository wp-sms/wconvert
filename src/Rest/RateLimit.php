<?php

namespace WConvert\Rest;

use WConvert\Storage\TransientStore;

defined('ABSPATH') || exit;

/**
 * How often one caller may hit the beacon — **the IP hashed into a short-lived
 * transient, and the IP itself stored nowhere** (issue #11, ADR 0019).
 *
 * ============================================================================
 * THE IP IS NEVER STORED. NOT IN THE KEY, NOT IN THE VALUE, NOT ANYWHERE.
 * ============================================================================
 * ADR 0006 cut IP geo, which removed the only rule that wanted an IP at all,
 * and storing one as consent proof is the single change that would turn a
 * WConvert table into one containing network identifiers, with retention and
 * subject-access obligations for a field nobody queries. Rate-limiting an
 * anonymous public endpoint is a real need and is met by hashing — the same
 * shape core uses for comment flood control. `wp_hash()` is an HMAC keyed on
 * the site's own salts, so the key cannot be reversed and cannot be correlated
 * across sites.
 *
 * **This limits the beacon and not the capture endpoint**, deliberately. They
 * are different traffic: a beacon fires on every page view a published Optin
 * matches, while a capture is one act a person performs rarely and cares about
 * a great deal. One shared window would let ordinary beacon volume exhaust a
 * visitor's allowance and refuse the submission they were still on the page to
 * fix — which is the failure ADR 0021 spent a whole ticket removing. The
 * capture endpoint's protection is that it re-reads everything about the form
 * from the server's own published copy and trusts the client for nothing but
 * the values a person typed.
 *
 * **What abuse costs is a wrong number on one merchant's dashboard**, not data
 * loss and not a breach — so this is hardening, not a security boundary, and
 * it stops where hardening stops (ADR 0019).
 *
 * @since 0.1.0
 */
final class RateLimit
{
    /** Namespaced so a site's transient list stays readable. */
    private const PREFIX = 'wconvert_beacon_';

    /**
     * The window, and the requests allowed in it.
     *
     * A real visitor sends one request per Optin impression plus one flush per
     * page view, so sixty a minute is many page views a minute from one
     * address — and one address is a whole office behind one NAT, which is why
     * the ceiling is generous rather than tight. Tightening it would refuse
     * real people before it inconvenienced anybody sending traffic on purpose.
     */
    private const WINDOW = 60;

    private const ALLOWED = 60;

    public function __construct(
        private readonly TransientStore $transients,
    ) {
    }

    /**
     * May this caller be counted right now?
     *
     * The window is FIXED rather than sliding: the first request in a window
     * stamps its start, and every request until it lapses is measured against
     * that stamp. A sliding window needs the timestamps of individual requests,
     * which is per-caller history — more storage about a visitor, kept longer,
     * to make a limit marginally smoother. Not a trade worth making here.
     *
     * An empty address — a request with no `REMOTE_ADDR`, which is what a
     * misconfigured proxy or a CLI caller produces — is refused rather than
     * bucketed with every other empty one. There is nobody to inconvenience.
     */
    public function allows(string $ip): bool
    {
        if ($ip === '') {
            return false;
        }

        $key = self::PREFIX . substr(wp_hash($ip), 0, 32);
        $now = time();

        /** @var mixed $bucket */
        $bucket = $this->transients->get($key);
        $start = is_array($bucket) ? (int) ($bucket['start'] ?? 0) : 0;
        $hits = is_array($bucket) ? (int) ($bucket['hits'] ?? 0) : 0;

        // A bucket whose window has lapsed is a new window, whether or not the
        // transient itself has been collected yet — an object cache may hand
        // back a value past its expiry, and the arithmetic must not depend on
        // it having been swept.
        if ($start + self::WINDOW <= $now) {
            $start = $now;
            $hits = 0;
        }

        $hits++;

        // Written on every request, refused ones included: a caller who keeps
        // knocking does not get a quieter window for it.
        $this->transients->set($key, ['start' => $start, 'hits' => $hits], self::WINDOW);

        return $hits <= self::ALLOWED;
    }
}
