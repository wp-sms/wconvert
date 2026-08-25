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
     * @param list<array<string, mixed>> $entries
     * @param string $captureUrl `rest_url()` for the capture route.
     * @param string $beaconUrl `rest_url()` for the beacon route.
     */
    public static function render(array $entries, string $captureUrl, string $beaconUrl): string
    {
        if ($entries === []) {
            return '';
        }

        // JSON_HEX_TAG is not optional. Without it a headline containing
        // `</script>` closes this element early and the rest of the payload
        // becomes markup. JSON_UNESCAPED_SLASHES and _UNICODE are there for
        // the byte budget: a URL and a non-ASCII headline are otherwise
        // escaped into two and six bytes per character.
        $json = json_encode($entries, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            return '';
        }

        return sprintf(
            '<script type="application/json" id="%s" %s="%s" %s="%s">%s</script>',
            self::ELEMENT_ID,
            self::CAPTURE_ATTRIBUTE,
            esc_url($captureUrl),
            self::BEACON_ATTRIBUTE,
            esc_url($beaconUrl),
            $json
        );
    }
}
