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
     * ========================================================================
     * THIS IS SIZED AGAINST LEGITIMATE TRAFFIC, NOT AGAINST ABUSE.
     * ========================================================================
     * The two failures are not symmetric. A refused ABUSIVE beacon costs
     * nothing — ADR 0019 books the loss from abuse as a wrong number on one
     * merchant's dashboard. A refused LEGITIMATE beacon costs an act that
     * really happened and can never be recomputed, and if it is an Impression
     * it removes a denominator, which makes conversion rate too high. So the
     * ceiling is set where legitimate traffic cannot reach it, and the abuse it
     * lets through is the cost of that.
     *
     * The arithmetic an earlier draft got wrong: a page view is NOT one
     * request. Every Impression flushes immediately, and an `inline` Optin
     * reports its own on entering the viewport, so a page carrying an overlay
     * and a few inline Optins costs three to five requests plus one `pagehide`
     * flush. At sixty a minute that throttled an office behind one NAT at
     * roughly a dozen page views a minute — well inside what a real building
     * does.
     *
     * Three hundred is fifty to a hundred page views a minute from one address,
     * which is a large office rather than a browser, and it still bounds what a
     * script can do to one merchant's numbers.
     *
     * Public because `bin/verify-stats.php` drives the real endpoint up to this
     * ceiling and past it; a copy of the number in that file would be a second
     * spelling to keep in step.
     */
    public const WINDOW = 60;

    public const ALLOWED = 300;

    public function __construct(
        private readonly TransientStore $transients,
    ) {
    }

    /**
     * May this caller be counted at this moment?
     *
     * **The clock is passed in.** This class owns none, for the same reason
     * {@see \WConvert\Stats\StatsRepository} owns no clock and no timezone: a
     * seam that reads `time()` internally cannot be moved, so the one branch
     * below that matters — a bucket whose window has lapsed but whose transient
     * an object cache has not swept — would be a paragraph of reasoning with
     * nothing exercising it.
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
    public function allows(string $ip, int $now): bool
    {
        if ($ip === '') {
            return false;
        }

        $key = self::PREFIX . substr(wp_hash($ip), 0, 32);

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
