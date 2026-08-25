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
 * **The direction of error decides every judgement call in this file.** An
 * Impression counted that should not have been inflates the denominator of
 * conversion rate, which makes the plugin look WORSE than it is; an Impression
 * MISSED does the opposite, and flattering the numbers is the error worth
 * engineering against — especially here, where nothing can ever be recomputed
 * (ADR 0019). So every doubt resolves towards counting: a crawler that renders
 * JavaScript and hides its identity gets counted, and so does a request with no
 * user agent at all.
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
     * Something that named itself.
     *
     * **An ABSENT user agent is COUNTED**, and an earlier draft of this file had
     * it the other way round. "Every browser sends one, so a request without one
     * is a script" is a HEURISTIC — the spec for this endpoint asks for none —
     * and it is a heuristic that fails in the expensive direction. A visitor
     * behind a UA-stripping extension or a privacy browser is a real person
     * looking at a real Optin, and dropping their Impression removes a
     * DENOMINATOR: it makes conversion rate too high, which is the one error
     * that flatters us, and it can never be recomputed (ADR 0019).
     *
     * What is left over-counts instead, which is the side to be wrong on.
     */
    private static function bot(string $userAgent): bool
    {
        $userAgent = strtolower($userAgent);

        foreach (self::BOTS as $bot) {
            if (str_contains($userAgent, $bot)) {
                return true;
            }
        }

        return false;
    }
}
