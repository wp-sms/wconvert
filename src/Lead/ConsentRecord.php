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
 * `resources/renderer/src/render.ts` splits a sentence on `%s`, `%b` and `%i` and
 * constructs the anchor, strong and em elements itself, and with nothing to fill a
 * mark it drops it along with the space in front of it. Two spellings of one rule is a real cost, paid here
 * because the alternative is evidence the browser wrote.
 * `tests/unit/Lead/ConsentSentenceParityTest.php` and
 * `tests/js/renderer-consent-parity.test.ts` read the same fixtures from both
 * sides, which is the arrangement that stops them drifting.
 *
 * @since 0.1.0
 */
final class ConsentRecord
{
    /** Where the link goes, and the only reason a leaf held more than a string (ADR 0013). */
    private const PLACEHOLDER = '%s';

    /** Where the emphasis goes. {@see \WConvert\Template\TemplateVocabulary} declares both as content. */
    private const EMPHASIS = '%b';

    private const ITALIC = '%i';

    /**
     * @param array<string, mixed> $node The `consent` node, as the Optin published it.
     * @param list<string> $schemes The schemes an `<a>` may carry, from the template manifest.
     */
    public static function asShown(array $node, array $schemes): string
    {
        $text = is_string($node['text'] ?? null) ? $node['text'] : '';
        $link = is_array($node['link'] ?? null) ? $node['link'] : [];
        $href = self::safeHref($link['href'] ?? null, $schemes);
        $emphasis = $node['emphasis'] ?? null;
        $italic = $node['italic'] ?? null;

        /*
         * What each mark is replaced by, or null where nothing fills it.
         *
         * No link, no destination the renderer would follow: both render the
         * sentence and no anchor, and the placeholder goes with it along with
         * the space in front of it (ADR 0032). The conditions are exactly the
         * guard `sentence()` uses in `resources/renderer/src/render.ts`, and
         * emphasis takes the same one for the same reason — a word appended to
         * a sentence that had no place for it is evidence of a sentence nobody
         * wrote.
         *
         * An empty LABEL is not the same as an absent link, and the asymmetry
         * is the point: the renderer builds the anchor and sets its text, so
         * an empty label renders an empty anchor and the mark is replaced by
         * nothing — leaving the space in front of it, which the strip below
         * would have removed. An empty EMPHASIS builds no element at all, so
         * it strips.
         */
        $fills = [
            self::PLACEHOLDER => $link === [] || $href === null
                ? null
                : (is_string($link['label'] ?? null) ? $link['label'] : ''),
            self::EMPHASIS => is_string($emphasis) && $emphasis !== '' ? $emphasis : null,
            self::ITALIC => is_string($italic) && $italic !== '' ? $italic : null,
        ];

        // Remove empty marks first, then expand each kind once. Replacement
        // words are never re-parsed as placeholders, matching the DOM renderer.
        $stripped = (string) preg_replace_callback('/ ?(%s|%b|%i)/', static fn (array $match): string =>
            $fills[$match[1]] === null ? '' : $match[0], $text);
        $pieces = preg_split('/(%s|%b|%i)/', $stripped, -1, PREG_SPLIT_DELIM_CAPTURE);
        $shown = '';
        foreach ($pieces === false ? [] : $pieces as $piece) {
            if (array_key_exists($piece, $fills) && $fills[$piece] !== null) {
                $shown .= $fills[$piece];
                $fills[$piece] = null;
            } else {
                $shown .= $piece;
            }
        }

        return $shown;
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
