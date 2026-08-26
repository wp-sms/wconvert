<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * The [[Consent Record]]: the consent wording **exactly as it was shown**, as
 * one sentence.
 *
 * A snapshot rather than a pointer to the template that produced it, because
 * the merchant will edit that wording and consent evidence that silently
 * rewrites itself to match the current copy is evidence of nothing
 * (ADR 0032).
 *
 * **Composed here rather than taken from the submission.** The capture
 * endpoint is public, so a wording the client supplied is a wording the client
 * chose — the server holds the real one already, in the published config the
 * payload was projected from.
 *
 * That makes this the PHP spelling of one rule the renderer also has:
 * `resources/renderer/src/render.ts` splits a sentence on `%s` and constructs
 * the `<a>` itself, and with no href it drops the placeholder along with the
 * space in front of it. Two spellings of one rule is a real cost, paid here
 * because the alternative is evidence the browser wrote.
 * `tests/unit/Lead/ConsentSentenceParityTest.php` and
 * `tests/js/renderer-consent-parity.test.ts` read the same fixtures from both
 * sides, which is the arrangement that stops them drifting.
 *
 * @since 0.1.0
 */
final class ConsentRecord
{
    /** The one placeholder a sentence may carry, and the only reason a leaf holds more than a string (ADR 0013). */
    private const PLACEHOLDER = '%s';

    /**
     * @param array<string, mixed> $node The `consent` node, as the Optin published it.
     * @param list<string> $schemes The schemes an `<a>` may carry, from the template manifest.
     */
    public static function asShown(array $node, array $schemes): string
    {
        $text = is_string($node['text'] ?? null) ? $node['text'] : '';
        $link = is_array($node['link'] ?? null) ? $node['link'] : [];
        $href = self::safeHref($link['href'] ?? null, $schemes);

        // No link, no destination the renderer would follow, or NOWHERE TO PUT
        // ONE: all three rendered the sentence and no anchor, and the
        // placeholder went with it along with the space in front of it
        // (ADR 0032). The three conditions, in that order, are exactly the
        // guard `sentence()` uses in `resources/renderer/src/render.ts`.
        if ($link === [] || $href === null || !str_contains($text, self::PLACEHOLDER)) {
            return (string) preg_replace('/ ?' . preg_quote(self::PLACEHOLDER, '/') . '/', '', $text);
        }

        // Only the FIRST placeholder is the link. A sentence carries one, so a
        // second `%s` stays literal text — which is what the renderer does when
        // it rejoins the remainder, and this has to be the same sentence.
        //
        // An empty label is NOT a special case here, and the asymmetry is the
        // point: the renderer builds the anchor and sets its text, so an empty
        // label renders an empty anchor and the placeholder is replaced by
        // nothing — leaving the space in front of it, which the strip branch
        // above would have removed.
        $label = is_string($link['label'] ?? null) ? $link['label'] : '';
        [$before, $after] = array_pad(explode(self::PLACEHOLDER, $text, 2), 2, '');

        return $before . $label . $after;
    }

    /**
     * The PHP spelling of `safeHref()` in `resources/renderer/src/render.ts`.
     *
     * The renderer drops an href outside the allowlist and renders NO anchor,
     * so a record composed without the same check would assert wording the
     * visitor never read — which is the one thing a [[Consent Record]] may
     * never do. `TemplateVocabulary` runs the same allowlist at write, and
     * this is not a second spelling of that rule so much as the same rule
     * where the first one cannot reach: {@see \WConvert\Template\PolicyLink}
     * fills an href in AFTER the write, from the site's own settings.
     *
     * @param mixed $href
     * @param list<string> $schemes
     */
    private static function safeHref($href, array $schemes): ?string
    {
        if (!is_string($href) || $href === '') {
            return null;
        }

        // A relative href — which a site-resolved policy URL may well be —
        // has no scheme of its own and is safe for the same reason the
        // renderer's `new URL(href, base)` makes it one: it can only ever
        // resolve against the page it is on.
        $scheme = wp_parse_url($href, PHP_URL_SCHEME);

        if ($scheme === null || $scheme === false) {
            return $href;
        }

        return in_array(strtolower((string) $scheme), $schemes, true) ? $href : null;
    }
}
