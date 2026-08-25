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
     */
    public static function asShown(array $node): string
    {
        $text = is_string($node['text'] ?? null) ? $node['text'] : '';
        $link = is_array($node['link'] ?? null) ? $node['link'] : [];
        $label = is_string($link['label'] ?? null) ? $link['label'] : '';
        $href = is_string($link['href'] ?? null) ? $link['href'] : '';

        // No href means the link rendered NOTHING, and the placeholder went
        // with it — a site with no privacy policy configured has no link to
        // offer, and offering a broken one is worse than offering none
        // (ADR 0032). The sentence the visitor read is the one without it, so
        // that is the sentence the evidence has to be.
        // No link, no destination for one, or NOWHERE TO PUT ONE: all three
        // rendered the sentence and no anchor, and the placeholder went with
        // it along with the space in front of it (ADR 0032).
        if ($label === '' || $href === '' || !str_contains($text, self::PLACEHOLDER)) {
            return (string) preg_replace('/ ?' . preg_quote(self::PLACEHOLDER, '/') . '/', '', $text);
        }

        // Only the FIRST placeholder is the link. A sentence carries one, so a
        // second `%s` is literal text — which is what the renderer does when it
        // rejoins the remainder, and this has to be the same sentence.
        [$before, $after] = array_pad(explode(self::PLACEHOLDER, $text, 2), 2, '');

        return $before . $label . $after;
    }
}
