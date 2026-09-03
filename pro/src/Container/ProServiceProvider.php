<?php

namespace WConvert\Pro\Container;

use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Pro\Frontend\ProInspectorEnqueue;
use WConvert\Pro\Frontend\ProLoaderEnqueue;
use WConvert\Pro\Template\ProTemplates;
use WConvert\Pro\WooCommerce\CartCookie;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;
use WConvert\Support\Tier;
use WConvert\Template\BundledTemplates;
use WConvert\Template\LockedTemplates;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * Pro's services, bound into the container FREE created.
 *
 * There is one container on the site and Pro binds into it rather than
 * standing up a second (ADR 0015), which is why this implements free's
 * {@see ServiceProvider} interface and why `WConvert\Bootstrap::container()`
 * is public. The dependency runs one way, as everywhere else in this split:
 * Pro reaches into free, free never reaches into Pro.
 *
 * It is Pro's FIRST provider, and it arrives with the first thing that needs
 * one. Nothing is written before its subject (ADR 0029), so there is still no
 * provider loop here — a second provider gets one, and until then a loop would
 * be scaffolding around a list of one.
 *
 * @since 0.1.0
 */
final class ProServiceProvider implements ServiceProvider
{
    public function register(ServiceContainer $container): void
    {
        // Where Pro is on disk and on the web, passed rather than read off the
        // constants inside — the same shape free's LoaderEnqueue takes, and
        // what lets `tests/unit/Pro/Frontend/LoaderReplacementTest.php` point
        // the replacement at a tree it controls.
        $container->register(
            ProLoaderEnqueue::class,
            static fn (): ProLoaderEnqueue => new ProLoaderEnqueue(WCONVERT_PRO_DIR, WCONVERT_PRO_URL)
        );

        // And the inspector's replacement, which is not optional: Pro's loader
        // beside free's inspector would report every `exit_intent` Optin as
        // `inert` while it worked perfectly.
        $container->register(
            ProInspectorEnqueue::class,
            static fn (): ProInspectorEnqueue => new ProInspectorEnqueue(WCONVERT_PRO_DIR, WCONVERT_PRO_URL)
        );

        // The whole of WConvert's coupling to WooCommerce: one cookie, so the
        // two cart [[Condition]]s can be answered synchronously in the browser
        // (ADR 0025).
        $container->register(CartCookie::class, static fn (): CartCookie => new CartCookie());

        /*
         * ====================================================================
         * PRO REGISTERS ITS OWN DESIGNS, THROUGH THE SEAM FREE EXTRACTED.
         * ====================================================================
         * {@see TemplateSource} was extracted naming *"Pro's own designs"* as
         * the first reason, and nothing had ever been plugged into it: free's
         * `TemplateLibrary::fromDirectory()` was the only composer anybody
         * called, and it hard-codes two sources rooted at `WCONVERT_DIR`. So a
         * Pro install shipped six `floating_bar` and `slide_in` CARDS and none
         * of the designs behind them.
         *
         * **Re-registering is the whole mechanism.** `ServiceContainer::register()`
         * overwrites the factory, `TemplateLibrary` is only ever resolved
         * lazily from inside other factories, and this runs at
         * `plugins_loaded` 20 — long before `rest_api_init` — so nothing stale
         * is cached and no free code has to know Pro exists. The import runs
         * Pro → free, which is the one direction ADR 0028 allows.
         *
         * **`LockedTemplates` stays LAST, and the order is the point.** A stub
         * whose id a registered entry already holds is dropped by
         * `TemplateLibrary::locked()`, which is how ADR 0026's *"a paying
         * customer is never shown an advertisement for what they bought"* falls
         * out of the id rather than out of a tier test somebody has to
         * remember. Free's own bundled designs stay in the list because Pro
         * ships free's gallery too — a Pro install has every popup and inline
         * design free has, plus these.
         */
        $container->register(
            TemplateLibrary::class,
            static fn (ServiceContainer $c): TemplateLibrary => TemplateLibrary::from(
                $c->resolve(TemplateVocabulary::class),
                new BundledTemplates(WCONVERT_DIR),
                new ProTemplates(WCONVERT_PRO_DIR),
                new LockedTemplates(WCONVERT_DIR),
            )
        );
    }

    public function boot(ServiceContainer $container): void
    {
        /*
         * ====================================================================
         * PRO REGISTERS THE PREMIUM RULE TYPES. THAT REGISTRATION IS THE
         * ENTITLEMENT.
         * ====================================================================
         * Free's degradation resolver strips a rule the install cannot
         * evaluate on its way to the page (ADR 0012), and what it asks is a
         * set-membership test against `SuppliedRules` — never "is Pro loaded".
         * This line is what puts `exit_intent`, `scroll_up`, `click_element`
         * and the premium Conditions in that set, so an install without Pro
         * substitutes or suspends and an install with it changes nothing.
         *
         * Pro names none of them: it asks the ONE manifest both plugins read
         * for the types filed under its own tier, exactly as free does for
         * hers. The premium split still adds zero new lists (ADR 0015).
         *
         * ABOVE the `is_admin()` guard below, and that is not an oversight.
         * The builder's rule rows and the Optin list's [[Suspended]] state are
         * admin screens that ask the same question, and a registry that was
         * only correct on the front end would tell a Pro customer their Optins
         * are suspended while the site shows them perfectly.
         */
        $container->resolve(SuppliedRules::class)->add(
            ...$container->resolve(RuleVocabulary::class)->typesAt(
                Tier::Pro,
                /*
                 * AND THE SITE HALF, WHICH IS WHAT #36 CLOSED.
                 *
                 * Registering every `tier: pro` type unconditionally was a
                 * live hole: on a Pro install with WooCommerce deactivated,
                 * `cart_has_items` was SUPPLIED, therefore not suspended,
                 * therefore shown — and the Optin said "You left 3 items in
                 * your cart" to somebody who has never added anything. That
                 * is the failure ADR 0027 exists for, arriving from the
                 * WooCommerce side instead of the Pro side, and
                 * `on_absence: suspend` alone does not close it because the
                 * field only fires when the type is UNSUPPLIED.
                 *
                 * Being loaded is still the whole of the ENTITLEMENT
                 * (ADR 0015). This is not a second entitlement question: it
                 * is whether Pro's module could answer at all, and with no
                 * store nothing writes the cart cookie it reads.
                 */
                $container->resolve(SitePresence::class)
            )
        );

        /*
         * THE CART COOKIE, HOOKED ABOVE THE `is_admin()` GUARD AND ONLY WHERE
         * THERE IS A STORE.
         *
         * Above the guard because adding to a cart is a VISITOR's act, and
         * one route for it — `admin-ajax.php` — reads as wp-admin however
         * little it resembles one. A writer that skipped it would leave the
         * shopper who added from a shop archive with no cookie, which is most
         * of them.
         *
         * And only with WooCommerce, because `woocommerce_cart_updated` is
         * WooCommerce's action: on a site without it the hook is a listener
         * for an event that cannot fire. Asked rather than left to WordPress
         * so the ABSENCE is stated once, beside the registration it belongs
         * to, rather than being a fact about a hook name nobody reads.
         */
        if ($container->resolve(SitePresence::class)->has(SiteDependency::WooCommerce)) {
            $container->resolve(CartCookie::class)->hooks();
        }

        // The same guard free's loader sits behind, and for the same reason:
        // wp-admin is not a page a visitor is looking at. There is deliberately
        // no SECOND condition here — no licence, no entitlement, no "is Pro
        // loaded". This code running IS the answer to that question (ADR 0015),
        // which is what "not one premium feature needs an `if`" means in
        // practice.
        if (is_admin()) {
            return;
        }

        $container->resolve(ProLoaderEnqueue::class)->hooks();
        $container->resolve(ProInspectorEnqueue::class)->hooks();
    }
}
