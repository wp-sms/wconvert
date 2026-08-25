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
     * @param list<array<string, mixed>> $entries
     */
    public static function render(array $entries): string
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
            '<script type="application/json" id="%s">%s</script>',
            self::ELEMENT_ID,
            $json
        );
    }
}
