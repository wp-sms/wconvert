<?php

namespace WConvert\Frontend;

use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * Where an `inline` [[Optin]] was put — the one element, spelled once.
 *
 * ============================================================================
 * THIS IS THE WHOLE CONTRACT BETWEEN AUTHORING AND RENDERING.
 * ============================================================================
 * `inline` is the one [[Display Type]] that is not an overlay: it renders
 * where it was embedded and never competes for the screen, which is why it
 * alone needs somewhere on the page to go while the other three mount
 * themselves. `resources/loader/src/present.ts` looks for that somewhere with
 * a single `document.querySelector` on a single attribute, and this is the
 * only thing in PHP that writes one.
 *
 * **One attribute, and nothing else.** A block, a shortcode and whatever
 * places an Optin next — a page builder, a `do_shortcode()` in a theme
 * template — are each one line into here. That is the property worth
 * defending: the day a third surface arrives it is a one-liner rather than a
 * fourth implementation of an element three other files already know how to
 * write, and there is no second place for the attribute name to drift.
 *
 * **It carries no class, no wrapper and no styles.** Everything visible is the
 * renderer's, inside a closed shadow root the loader mounts into this element
 * (ADR 0009, ADR 0010) — so a class here would be a hook a theme could reach
 * that the design itself deliberately does not offer.
 *
 * @since 0.1.0
 */
final class InlineAnchor
{
    /**
     * The attribute, and its one other spelling is
     * `INLINE_ANCHOR_ATTRIBUTE` in `resources/loader/src/present.ts`.
     *
     * Two spellings because one of them has to be TypeScript and the other has
     * to be PHP, and there is no build step between them to derive either.
     * What holds them together is `tests/unit/Frontend/InlineAnchorTest.php`,
     * which reads the constant out of the loader's own source — a
     * disagreement here throws nothing and looks like nothing, since the
     * anchor is on the page and the loader is querying for a name that is not
     * on it. Every inline Optin on the site renders nothing, quietly.
     */
    public const ATTRIBUTE = 'data-wconvert-optin';

    /**
     * The anchor for one Optin, or an empty string where the id is not one.
     *
     * ========================================================================
     * A MALFORMED ID EMITS NOTHING, AND THAT IS THE SAFE DIRECTION.
     * ========================================================================
     * The id reaches here from post content — a block attribute a merchant
     * saved, or a shortcode attribute they typed — so it is not the trusted
     * value the published set holds. {@see Ulid::isOne()} is the same closed
     * check the REST routes spell as a route constraint, and refusing here
     * means a mistyped id is an element that is not on the page rather than an
     * attribute value that reaches `querySelector` as a selector fragment.
     *
     * `esc_attr()` is beside it rather than instead of it. Belt and brace, in
     * the one place in this plugin where a merchant's typing becomes markup.
     *
     * **An id that is well-formed but names no published inline Optin still
     * gets its anchor**, and that is deliberate rather than an omission. Both
     * surfaces stay exactly as clever as each other, which is what makes them
     * substitutable; the loader already does the right thing with an anchor it
     * has no payload entry for — it never looks at it — so an anchor whose
     * Optin was deleted renders nothing and records nothing on its own. Where
     * a merchant is TOLD about it is the editor, which is the surface that can
     * ask ({@see InlineOptinBlock}).
     */
    public static function html(string $optinId): string
    {
        if (!Ulid::isOne($optinId)) {
            return '';
        }

        return '<div ' . self::ATTRIBUTE . '="' . esc_attr($optinId) . '"></div>';
    }
}
