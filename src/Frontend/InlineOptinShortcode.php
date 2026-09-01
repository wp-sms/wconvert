<?php

namespace WConvert\Frontend;

defined('ABSPATH') || exit;

/**
 * `[wconvert_optin id="…"]` — the authoring surface for everywhere the block
 * is not.
 *
 * The classic editor, the page builders, a text widget, and a theme template
 * calling `do_shortcode()`. It takes the Optin id and nothing else, because
 * there is nothing else: {@see InlineAnchor} is the whole contract and it has
 * one attribute.
 *
 * @since 0.1.0
 */
final class InlineOptinShortcode
{
    /**
     * The tag, prefixed, because a shortcode name is a site-wide global.
     *
     * `[optin]` would collide with the next plugin that wants the word, and a
     * collision here is silent in the direction that costs the merchant most:
     * whichever plugin registered last wins, and the loser's shortcode starts
     * rendering the other one's markup in posts nobody edited.
     */
    public const TAG = 'wconvert_optin';

    /**
     * Register the shortcode.
     *
     * On `init` beside the block rather than earlier, though nothing here
     * translates: `do_shortcode()` runs on `the_content`, so any hook before
     * that would do, and one place for both surfaces is worth more than the
     * earliest possible one.
     */
    public function register(): void
    {
        add_shortcode(self::TAG, [self::class, 'render']);
    }

    /**
     * The anchor for the Optin this shortcode names.
     *
     * Static and pure, exactly as {@see InlineOptinBlock::render()} is, and
     * for the same reason: it is the half a unit suite can hold the two
     * surfaces to.
     *
     * **No `shortcode_atts()`.** That function exists to merge defaults and
     * normalise a key set, and there is one key with no default worth
     * declaring — an absent `id` and an empty one both mean *nothing to
     * place*, and {@see InlineAnchor::html()} answers both the same way.
     *
     * @param array<string, string>|string $atts As WordPress parsed them —
     *        an EMPTY STRING where the shortcode carried no attributes at all,
     *        which is the one shape a naive `$atts['id']` gets wrong.
     */
    public static function render($atts): string
    {
        $id = is_array($atts) ? (string) ($atts['id'] ?? '') : '';

        return InlineAnchor::html($id);
    }
}
