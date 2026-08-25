<?php

namespace WConvert\Stats;

defined('ABSPATH') || exit;

/**
 * Whether a request to the beacon came from somebody who will actually look at
 * the page.
 *
 * **`Sec-Purpose`, bot user agent, and nothing else — no heuristics** (ADR
 * 0019). There is no identifier left on a stateless beacon to score a
 * suspicious request against (ADR 0017), so a scoring pass here would be a
 * guess wearing a number. What is left is the requests that SAY what they are,
 * and this file believes them.
 *
 * Pure and header-shaped rather than request-shaped, so the rule can be
 * exhausted against the exact strings browsers send without a WordPress
 * request object to build. {@see \WConvert\Rest\BeaconController} reads the
 * three headers; this decides.
 *
 * The direction of error matters and is chosen. An Impression that should not
 * have been counted inflates the denominator of conversion rate, which makes
 * the plugin look WORSE than it is; a Conversion that should not have been
 * counted flatters it. Everything here filters the first kind, and a crawler
 * that renders JavaScript and hides its identity gets counted — a known and
 * accepted inaccuracy, not a gap somebody forgot.
 *
 * @since 0.1.0
 */
final class BeaconTraffic
{
    /**
     * Requests a browser makes on the *chance* a visitor will navigate.
     *
     * A page fetched speculatively and never visited was never seen. The
     * browser half of the same rule is `document.prerendering` in the loader,
     * which HOLDS its events rather than dropping them and flushes on
     * activation — a prerender the visitor did go on to open is an Impression
     * by every definition the glossary offers (CONTEXT.md, Impression).
     */
    private const SPECULATIVE = ['prefetch', 'prerender'];

    /**
     * Bots, as substrings of a lowercased user agent.
     *
     * **Deliberately short.** A list long enough to catch an agent that lies is
     * a list long enough to catch real browsers, and the cost of a false
     * positive here is a real Impression silently missing from a number nobody
     * can ever recompute (ADR 0019).
     */
    private const BOTS = [
        'bot',
        'crawl',
        'spider',
        'slurp',
        'headless',
        'lighthouse',
        'pagespeed',
        'pingdom',
        'gtmetrix',
        'wget',
        'curl',
        'python-requests',
    ];

    /**
     * Is this worth counting?
     *
     * `$purpose` is the pre-standard header the same browsers sent before
     * `Sec-Purpose`, and the one Firefox still sends. One extra argument, and
     * the alternative is counting every link-hover prefetch on a site running
     * an instant-page script as an Impression.
     */
    public static function countable(string $secPurpose, string $purpose, string $userAgent): bool
    {
        return !self::speculative($secPurpose, $purpose) && !self::bot($userAgent);
    }

    private static function speculative(string $secPurpose, string $purpose): bool
    {
        $secPurpose = strtolower($secPurpose);

        foreach (self::SPECULATIVE as $speculative) {
            if (str_contains($secPurpose, $speculative)) {
                return true;
            }
        }

        return strtolower(trim($purpose)) === 'prefetch';
    }

    /**
     * An ABSENT user agent counts as a bot. Every browser sends one; a request
     * without it is a script that did not bother, and what it would add is the
     * denominator of somebody's conversion rate.
     */
    private static function bot(string $userAgent): bool
    {
        $userAgent = strtolower($userAgent);

        if (trim($userAgent) === '') {
            return true;
        }

        foreach (self::BOTS as $bot) {
            if (str_contains($userAgent, $bot)) {
                return true;
            }
        }

        return false;
    }
}
