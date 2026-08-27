<?php

namespace WConvert\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Goal\Goal;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;
use WConvert\Rules\Degradation;
use WConvert\Template\CartLink;
use WConvert\Template\PolicyLink;

defined('ABSPATH') || exit;

/**
 * Puts the loader and its payload on the page — and, far more often, does not.
 *
 * The whole front-end read path is here: read one non-autoloaded option, walk
 * its projections, evaluate the Targeting axis, and print what survived.
 * **No transient, no object-cache entry, no per-URL memo of any kind.** The
 * full-page cache is the cache (ADR 0003); a transient keyed by URL would
 * cache something already cached and add an invalidation surface that will
 * eventually be wrong. `tests/unit/Frontend/NoSecondCacheTest.php` is what
 * keeps that true.
 *
 * @since 0.1.0
 */
final class LoaderEnqueue
{
    public const HANDLE = 'wconvert-loader';

    /**
     * When this runs on `wp_enqueue_scripts`.
     *
     * A named constant because **[[Pro]] replaces this loader by dequeuing it
     * on the same hook, later** (ADR 0014), and "later" has to be a fact the
     * two plugins share rather than two numbers that agree by habit. Pro reads
     * it — `WConvert\Pro\Frontend\ProLoaderEnqueue::PRIORITY` is this plus
     * ten — so the ordering cannot drift, and it does not depend on which
     * plugin file WordPress loaded first.
     */
    public const PRIORITY = 10;

    private const DIST = 'public/loader/loader.js';

    public function __construct(
        private readonly PublishedSet $publishedSet,
        private readonly Degradation $degradation,
    ) {
    }

    public function hooks(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'enqueue'], self::PRIORITY);
    }

    public function enqueue(): void
    {
        // A feed, a robots.txt or an oEmbed response is not a page a visitor
        // is looking at, and printing a script tag into one corrupts it.
        if (is_admin() || is_feed() || is_robots() || is_embed()) {
            return;
        }

        // Parsed once, here, and passed as objects from this point on. The set
        // is stored as plain arrays because that is what an option is; letting
        // those arrays travel further means every reader downstream spells a
        // rule type as a string literal (ADR 0005).
        $set = PublishedOptin::fromSet($this->publishedSet->all());

        if ($set === []) {
            return;
        }

        // Degradation is applied HERE, on the way to the page, and not at
        // publish time — a premium rule is still in `published_config` when
        // [[Pro]] stops being loaded, and config outlives the code that reads
        // it (ADR 0012). What this passes down is not an entitlement: it is a
        // registry of the rule types that actually registered on this request
        // ({@see \WConvert\Rules\SuppliedRules}), which is why the front-end
        // path still asks no tier question of any kind (ADR 0015).
        $entries = Payload::forRequest($set, RequestContextFactory::forPublishedSet($set), $this->degradation);

        // An Optin that does not match this page costs this page nothing —
        // not a script, not a byte of payload.
        if ($entries === []) {
            return;
        }

        // **The renderer owns the privacy-policy link, and this is render
        // time** (ADR 0032). It is resolved here rather than baked into the
        // published set so that moving the policy page corrects every running
        // Optin without republishing one, and it is safe under the full-page
        // cache because `get_privacy_policy_url()` is a site-wide setting
        // identical for every visitor.
        $policy = get_privacy_policy_url();
        $entries = array_map(static fn (array $entry): array => PolicyLink::into($entry, $policy), $entries);

        // **And the way back to the cart, on the same terms** (ADR 0025). The
        // cart page is site-local, so a [[Playbook]] cannot name it and the
        // published set must not freeze it — the merchant who moves their cart
        // page corrects every running Optin without republishing one.
        //
        // Keyed on the [[Goal]] rather than on the shape of the button,
        // because *Promote a sale or offer* ships the same click-metered CTA
        // with no href and its destination is the merchant's. `CartLink` is
        // where that argument lives.
        //
        // **Which Optins** is answered from the set that was already parsed;
        // **where the cart is** is read here and passed down, so the rule
        // itself stays a pure function of (entries, ids, url) — the same
        // arrangement `PolicyLink` has one line up, and what lets both be
        // tested without a WordPress install or a WooCommerce one.
        //
        // `wc_get_cart_url()` reads a WooCommerce option and runs a filter, so
        // it is asked only where a cart Optin actually matched this page,
        // which is almost never: an Optin that does not match costs the page
        // nothing (ADR 0003).
        $cartOptins = self::cartOptinsIn($set);

        if ($cartOptins !== []) {
            $entries = self::withCartUrl(
                $entries,
                $cartOptins,
                function_exists('wc_get_cart_url') ? (string) wc_get_cart_url() : null
            );
        }

        $dist = WCONVERT_DIR . self::DIST;

        // **Reported from wp-admin, not from here.** This method runs on
        // `wp_enqueue_scripts` and returns above on `is_admin()`, so an
        // `admin_notices` callback added at this point would be registered on
        // a front-end request — where `admin_notices` never fires and nobody
        // would ever have read it. {@see \WConvert\Admin\AdminNotices::checkLoaderBundle()}
        // asks the same question where the answer can be seen. All this can
        // honestly do on a visitor's page is print nothing.
        if (!is_file($dist)) {
            return;
        }

        wp_enqueue_script(
            self::HANDLE,
            WCONVERT_URL . self::DIST,
            [],
            BuiltAsset::version($dist),
            true
        );

        // Priority 5 on `wp_head`: after `wp_enqueue_scripts` (which core runs
        // at 1) so this callback is registered in time, and early enough that
        // the payload precedes anything an optimizer aggregates into the head.
        // The loader still must not ASSUME that — Autoptimize's force-in-head
        // moves it above the payload and strips its `defer`, which is why the
        // loader retries after DOMContentLoaded (ADR 0004).
        $captureUrl = rest_url(Routes::NAMESPACE . '/capture');
        $beaconUrl = rest_url(Routes::NAMESPACE . '/beacon');

        add_action('wp_head', static function () use ($entries, $captureUrl, $beaconUrl): void {
            // Not escaped, and correctly so: PayloadTag renders JSON with
            // JSON_HEX_TAG, which is the escaping this context needs. Running
            // esc_html() over it would escape the quotes and produce invalid
            // JSON — a silent break, because the tag still renders and only
            // the loader's JSON.parse fails, in the browser, at runtime. It
            // escapes the two route URLs itself with esc_url(), where the
            // context is an attribute and esc_url is what that needs.
            //
            // PHPCS sees `echo <a function call>` and can see neither of those
            // facts. {@see PayloadTag::render()} is where they are enforced,
            // and tests/unit/Frontend/PayloadTest.php is what holds them.
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- PayloadTag::render() escapes for this context: JSON_HEX_TAG on the body, esc_url() on the attributes.
            echo PayloadTag::render($entries, $captureUrl, $beaconUrl);
        }, 5);
    }

    /**
     * Which of this page's Optins exist to send a shopper back to their cart.
     *
     * **Keyed on the [[Goal]] rather than on the shape of the button.**
     * *Promote a sale or offer* ships the same click-metered CTA with no href
     * and its destination is the merchant's, so a purely structural rule — the
     * one {@see PolicyLink} can afford, because a site has exactly one privacy
     * policy — would silently point an unconfigured sale Optin at the cart.
     *
     * A lookup rather than a list, so the map below tests membership with
     * `isset`. The Optins were parsed once at the top of {@see self::enqueue()}
     * and the Goal rides the projection beside the payload, so this walks what
     * has already been read rather than the option again (ADR 0003).
     *
     * **Separate from {@see self::withCartUrl()} rather than folded into it**,
     * because the answer decides whether to ASK where the cart is at all:
     * `wc_get_cart_url()` reads an option and runs a filter, and a page with
     * no cart Optin on it must pay neither. One walk, then a decision — the
     * alternative is walking the set twice to keep that laziness.
     *
     * Public and static for the same reason its partner is: both are pure
     * functions of what the enqueue path has already read, and everything
     * between them is WordPress calls a unit suite cannot make.
     *
     * @param list<PublishedOptin> $set
     * @return array<string, true>
     */
    public static function cartOptinsIn(array $set): array
    {
        $ids = [];

        foreach ($set as $optin) {
            if ($optin->goal === Goal::RecoverCart) {
                $ids[$optin->id] = true;
            }
        }

        return $ids;
    }

    /**
     * Those entries, pointed back at the cart.
     *
     * With no WooCommerce there is no URL, and none is invented — never a dead
     * `#`. Such an Optin is [[Suspended]] anyway, because both cart
     * [[Condition]]s carry `on_absence: suspend` and neither is supplied
     * without a store (ADR 0027), so that branch is the belt beside this
     * brace.
     *
     * Public and static for the reason {@see Payload::forRequest()} is: it is
     * a pure function of what the enqueue path has already read, and the whole
     * of the surrounding method is WordPress calls a unit suite cannot make.
     *
     * @param list<array<string, mixed>> $entries
     * @param array<string, true> $cartOptins As {@see self::cartOptinsIn()} built it.
     * @param string|null $url `wc_get_cart_url()`, or null where there is no store.
     * @return list<array<string, mixed>>
     */
    public static function withCartUrl(array $entries, array $cartOptins, ?string $url): array
    {
        return array_map(
            static fn (array $entry): array => isset($cartOptins[$entry['id'] ?? ''])
                ? CartLink::into($entry, $url)
                : $entry,
            $entries
        );
    }

}
