<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The way back to the cart, resolved into a template tree at render time.
 *
 * ============================================================================
 * THE SAME SHAPE AS {@see PolicyLink}, AND FOR THE SAME REASON.
 * ============================================================================
 * A [[Playbook]] can express nothing site-local — no post ids, no
 * [[Destination]] ids, no privacy-policy link and **no cart URL**. The cart
 * page is a page on one particular site, so a bundled entry naming one would
 * be wrong on every other install. The words are the Playbook's and the
 * destination is the site's (ADR 0025).
 *
 * **Resolved per request, never frozen at publish.** The published set is
 * rebuilt on write (ADR 0003), so an href baked into it would still name the
 * old cart page after the merchant moved it — and `wc_get_cart_url()` is a
 * site-wide setting identical for every visitor, so reading it is safe under
 * the full-page cache the payload is baked into.
 *
 * ============================================================================
 * WHY THE RULE IS ABOUT THE OPTIN AND NOT ONLY ABOUT THE NODE.
 * ============================================================================
 * {@see PolicyLink}'s rule is purely structural: a link that declares a label
 * and names no destination is asking for the one destination only the site can
 * name, and there is exactly one such destination on a WordPress site. **A
 * CTA has no such uniqueness.** *Promote a sale or offer* also ships a
 * click-metered button with no href — the merchant types the offer's URL in
 * the builder — so a purely structural rule here would silently point an
 * unconfigured sale Optin at the cart.
 *
 * What distinguishes them is the [[Goal]], which is what an Optin's CTA is
 * FOR. So the caller passes only the entries whose Goal is
 * {@see \WConvert\Goal\Goal::RecoverCart}, and the Goal rides the published
 * projection beside the payload rather than inside it — PHP needs it and the
 * browser does not.
 *
 * **The settings-panel override is the merchant's href winning.** A `button`
 * declares `href` as content, so the panel already draws a control for it
 * ({@see \WConvert\Template\TemplateVocabulary}, `resources/templates/manifest.json`).
 * A merchant who types one has named a destination, and this fills in only
 * where nobody has — the override is therefore the absence of a special case
 * rather than a branch.
 *
 * The URL is passed in rather than read here, so this is a pure function of
 * (payload, url) and testable without WordPress or WooCommerce — the same
 * arrangement {@see PolicyLink} has.
 *
 * @since 0.1.0
 */
final class CartLink
{
    /**
     * One payload entry with its CTA pointed back at the cart.
     *
     * With no cart URL — WooCommerce gone, or its cart page deleted — the
     * href is left absent and the button renders with none. Never a dead `#`:
     * `render.ts` drops an href it cannot make safe and the anchor is inert,
     * which is the same answer PolicyLink gives for a site with no privacy
     * policy. The Optin is suspended in that case anyway, since both cart
     * [[Condition]]s carry `on_absence: suspend` and neither is supplied
     * without a store — so this is the belt beside that brace rather than the
     * mechanism.
     *
     * @param array<string, mixed> $payload One entry, as it travels to the browser.
     * @param string|null $url `wc_get_cart_url()`, or null where there is no store.
     * @return array<string, mixed>
     */
    public static function into(array $payload, ?string $url): array
    {
        $steps = $payload['template']['tree']['steps'] ?? null;

        if ($url === null || $url === '' || !is_array($steps)) {
            return $payload;
        }

        $payload['template']['tree']['steps'] = array_map(
            static fn ($step): mixed => is_array($step) ? self::resolve($step, $url) : $step,
            array_values($steps)
        );

        return $payload;
    }

    /**
     * @param array<string, mixed> $node
     * @return array<string, mixed>
     */
    private static function resolve(array $node, string $url): array
    {
        // The converting act, in its click spelling. `action: link` is what
        // the renderer draws as an anchor and what {@see ConvertingAct} reads
        // to decide the Template's metric, so asking the same key here means
        // the three cannot disagree about which node converts.
        //
        // An href already there is the merchant's, typed into the settings
        // panel, and it wins. **Emptiness is judged the way a form field is**
        // — an absent key and an empty string both mean "nothing was chosen",
        // which is the reading {@see \WConvert\Rules\RuleVocabulary::couldFire()}
        // already takes one axis over. The panel deletes the key when a
        // control is cleared, so the two agree; an entry hand-written or
        // imported with `href: ""` is the case that would otherwise leave a
        // merchant who cleared the field with a dead CTA and nothing to read.
        $href = $node['href'] ?? null;

        if (($node['type'] ?? null) === 'button'
            && ($node['action'] ?? null) === 'link'
            && (!is_string($href) || $href === '')
        ) {
            $node['href'] = $url;
        }

        foreach (TemplateTree::CHILD_KEYS as $key) {
            if (is_array($node[$key] ?? null)) {
                $node[$key] = array_map(
                    static fn ($child): mixed => is_array($child) ? self::resolve($child, $url) : $child,
                    array_values($node[$key])
                );
            }
        }

        return $node;
    }
}
