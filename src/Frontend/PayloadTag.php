<?php

namespace WConvert\Frontend;

defined('ABSPATH') || exit;

/**
 * The payload's one wire format: `<script type="application/json">`.
 *
 * Every JS optimizer tested (Autoptimize, LiteSpeed, Flying Scripts) selects
 * on `script[!type]` or `type="text/javascript"`, so this tag is invisible to
 * all of them and stays where it was printed; HTML minifiers left it
 * parseable. The alternative, `wp_add_inline_script(..., 'before')`, is also
 * position-safe but lands the per-URL payload INSIDE the aggregated bundle,
 * which turns one shared loader into a per-URL asset — measured at 9 bundles
 * and 108 KB against 3 and 28 KB (ADR 0004).
 *
 * @since 0.1.0
 */
final class PayloadTag
{
    public const ELEMENT_ID = 'wconvert-payload';

    /**
     * Where the capture endpoint is on this site.
     *
     * It rides on the payload element as an attribute rather than inside the
     * JSON, because it is one fact about the SITE and the JSON is a list of
     * facts about Optins — repeating it per entry would pay for it as many
     * times as the page has Optins, against a 2KB budget.
     *
     * The loader cannot compute it: it is a raw IIFE with no `wp-api-fetch`
     * and no `wpApiSettings`, deliberately, because either would put a second
     * script on the page (ADR 0004). And the full ROUTE is passed rather than
     * a namespace root, so a route name is spelled in PHP and nowhere else.
     */
    public const CAPTURE_ATTRIBUTE = 'data-capture';

    /**
     * Where the analytics beacon is on this site.
     *
     * A second attribute rather than a namespace root the loader appends a
     * route name to: the reasoning on {@see self::CAPTURE_ATTRIBUTE} is that a
     * route name is spelled in PHP and nowhere else, and half a URL in an
     * attribute plus half in TypeScript is that rule broken while looking like
     * it is kept. Two full routes cost about sixty bytes against a 2KB
     * gzipped budget, and they compress against each other — they differ in
     * one word.
     */
    public const BEACON_ATTRIBUTE = 'data-beacon';

    /**
     * The allowance the whole site shares.
     *
     * A fourth attribute for the first one's reason: it is **one fact about
     * the site** and the JSON is a list of facts about Optins, so putting it
     * inside would mean either repeating it per entry or turning a list into
     * an object with a list in it.
     *
     * It is the one of the four that is CONDITIONAL, and that is why it prints
     * its own leading space and goes last.
     *
     * **Absent is the shipped state and costs nothing.** All four fields
     * default off at site scope (ADR 0047), so until a merchant configures one
     * there is no attribute here at all and the page is byte-for-byte the page
     * it is today. {@see \WConvert\Optin\SiteFrequency::forPayload()} is where
     * that null is decided.
     */
    public const SITE_ALLOWANCE_ATTRIBUTE = 'data-allowance';

    /**
     * The site's own timezone — an IANA name, or a fixed offset.
     *
     * A third attribute for {@see self::CAPTURE_ATTRIBUTE}'s reason: one fact
     * about the SITE, beside a JSON list of facts about Optins.
     *
     * ====================================================================
     * IT IS PRINTED ALWAYS, AND THAT IS ADR 0005 RATHER THAN LAZINESS.
     * ====================================================================
     * Only `time_of_day` reads it, so printing it only where an entry carries
     * that rule would save about twenty bytes on most pages. It would also
     * mean PHP asking what CLIENT rule types this page's Optins name, which is
     * the one thing the three-axis split exists to prevent: the client
     * vocabulary is closed, PHP never reasons about a member of it, and a
     * conditional here is where that would start.
     *
     * Twenty bytes against two full route URLs is a price worth paying for
     * that, and the loader is where the decision belongs anyway — a page with
     * no time rule on it simply never reads the attribute.
     */
    public const TIMEZONE_ATTRIBUTE = 'data-tz';

    /**
     * @param list<array<string, mixed>> $entries
     * @param string $captureUrl `rest_url()` for the capture route.
     * @param string $beaconUrl `rest_url()` for the beacon route.
     * @param array<string, mixed>|null $siteAllowance The four fields the whole
     *   site shares, or null where the merchant has configured none.
     *
     *   **Required, and null is the answer most sites give.** A default would
     *   let a caller forget it and print a page whose site-wide cap silently
     *   does nothing — and it would let the byte tests measure a tag the front
     *   end never renders (CLAUDE.md: no back-compat shims; this is the same
     *   rule read at a signature).
     * @param string $timezone `wp_timezone()->getName()` — an IANA name, or a
     *   fixed offset for a site with no city chosen.
     */
    public static function render(
        array $entries,
        string $captureUrl,
        string $beaconUrl,
        ?array $siteAllowance,
        string $timezone
    ): string {
        if ($entries === []) {
            return '';
        }

        $hasReopen = false;
        foreach ($entries as &$entry) {
            if (isset($entry['teaser']) && is_array($entry['teaser'])) {
                $entry['teaser'] = \WConvert\Optin\Teaser::forPayload($entry['teaser']);
                $hasReopen = true;
            }
        }
        unset($entry);

        // JSON_HEX_TAG is not optional. Without it a headline containing
        // `</script>` closes this element early and the rest of the payload
        // becomes markup. JSON_UNESCAPED_SLASHES and _UNICODE are there for
        // the byte budget: a URL and a non-ASCII headline are otherwise
        // escaped into two and six bytes per character.
        $json = json_encode($entries, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            return '';
        }

        $reopenLabels = [__('Dismiss reminder', 'wconvert'), __('Submission received — View details', 'wconvert')];
        $localized = $hasReopen && $reopenLabels !== ['Dismiss reminder', 'Submission received — View details']
            ? ' data-reopen="' . esc_attr((string) json_encode($reopenLabels, JSON_UNESCAPED_UNICODE)) . '"' : '';

        $lockLabels = [__('Content unlocked.', 'wconvert'), __('Continue to content', 'wconvert'), __('Your submission could not be confirmed. The content is available below.', 'wconvert')];
        if (array_filter($entries, static fn (array $entry): bool => isset($entry['content_lock'])) !== []
            && $lockLabels !== ['Content unlocked.', 'Continue to content', 'Your submission could not be confirmed. The content is available below.']) {
            $localized .= ' data-content-lock="' . esc_attr((string) json_encode($lockLabels, JSON_UNESCAPED_UNICODE)) . '"';
        }
        $journeyLabels = [__('Continue', 'wconvert'), __('Submission not confirmed. Please try again.', 'wconvert')];
        if (array_filter($entries, static fn (array $entry): bool => isset($entry['capture_contract'])) !== []
            && $journeyLabels !== ['Continue', 'Submission not confirmed. Please try again.']) {
            $localized .= ' data-journey="' . esc_attr((string) json_encode($journeyLabels, JSON_UNESCAPED_UNICODE)) . '"';
        }
        return sprintf(
            '<script type="application/json" id="%s" %s="%s" %s="%s" %s="%s"%s%s>%s</script>',
            self::ELEMENT_ID,
            self::CAPTURE_ATTRIBUTE,
            esc_url($captureUrl),
            self::BEACON_ATTRIBUTE,
            esc_url($beaconUrl),
            self::TIMEZONE_ATTRIBUTE,
            // `esc_attr()` rather than `esc_url()`: this is a zone name, and
            // the escaping an attribute needs is the attribute's.
            esc_attr($timezone),
            // Last of the three, because it is the one that prints its own
            // leading space or nothing at all.
            self::siteAllowanceAttribute($siteAllowance),
            $localized,
            $json
        );
    }

    /**
     * The site's allowance as one attribute, or **the empty string**.
     *
     * `JSON_FORCE_OBJECT` is not decoration. Every one of the four fields is
     * optional, so an allowance that turns both switches on and caps no number
     * encodes as `[]` — a JSON *array*, which `payload.ts` refuses in the same
     * breath it refuses a blob it cannot parse. `{}` is that same allowance,
     * readable.
     *
     * `esc_attr()` rather than `esc_url()`, because this is JSON rather than a
     * URL: the double quote on every key is what would otherwise close the
     * attribute on its first character.
     *
     * @param array<string, mixed>|null $allowance
     */
    private static function siteAllowanceAttribute(?array $allowance): string
    {
        if ($allowance === null) {
            return '';
        }

        $json = json_encode($allowance, JSON_FORCE_OBJECT | JSON_UNESCAPED_SLASHES);

        // Unencodable is the same answer as absent, and it fails OPEN: the
        // page carries no site allowance and behaves as it does today, rather
        // than carrying half of one.
        return $json === false ? '' : sprintf(' %s="%s"', self::SITE_ALLOWANCE_ATTRIBUTE, esc_attr($json));
    }
}
