<?php

namespace WConvert\Pro\Container;

use WConvert\Admin\AdminNotices;
use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Pro\Admin\ProAdminEnqueue;
use WConvert\Pro\Frontend\ProInspectorEnqueue;
use WConvert\Pro\Frontend\ProLoaderEnqueue;
use WConvert\Pro\Module\AbTesting\AbTestController;
use WConvert\Pro\Module\CartRecovery\CartCookie;
use WConvert\Pro\Template\ProTemplates;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\ProPresence;
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

        // AND THE ADMIN BUNDLE, on ADR 0014's rule rather than beside it. Two
        // separately-installed plugins mean two script tags, and the only
        // alternative to replacement is a second script injecting React into
        // free's running app — a load-order contract across two tags on a page
        // an optimiser may reorder (ADR 0004). {@see ProAdminEnqueue} argues it
        // at length.
        //
        // It takes free's notices object because that is the one path a message
        // about the admin screen survives on: `admin_notices` is emptied on
        // WConvert's own screens (ADR 0035).
        $container->register(
            ProAdminEnqueue::class,
            static fn (ServiceContainer $c): ProAdminEnqueue => new ProAdminEnqueue(
                WCONVERT_PRO_DIR,
                WCONVERT_PRO_URL,
                $c->resolve(AdminNotices::class)
            )
        );

        // The whole of WConvert's coupling to WooCommerce: one cookie, so the
        // two cart [[Condition]]s can be answered synchronously in the browser
        // (ADR 0025).
        //
        // Registered only where the `cart-recovery` module shipped — see
        // boot() for why that is a file-system question and not a tier one. The
        // factory is lazy, so an unguarded `register()` would not itself fatal;
        // it would leave a resolvable id for a class that cannot load, which is
        // a fatal moved to whoever asks next.
        if (class_exists(CartCookie::class)) {
            $container->register(CartCookie::class, static fn (): CartCookie => new CartCookie());
        }

        // And A/B testing's two routes, on the same terms and for the same
        // reason: `ab-testing` is the `pro` rung's module, so on a Basic build
        // this class is not on disk and Pro's autoloader finds nothing for it.
        // The routes are then ABSENT rather than present and refusing, which
        // is the whole of the entitlement (ADR 0015).
        //
        // The write itself is free's: {@see OptinRepository} is the one place
        // the published set is rebuilt (ADR 0003) and the one place that
        // cannot reach for a `DELETE` (ADR 0020). This registers the ROUTE.
        if (class_exists(AbTestController::class)) {
            $container->register(
                AbTestController::class,
                static fn (ServiceContainer $c): AbTestController => new AbTestController(
                    $c->resolve(OptinRepository::class)
                )
            );
        }

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
         * overwrites the factory and this runs at `plugins_loaded` 20 — long
         * before `rest_api_init` can resolve even the lightweight deferred
         * library — so nothing stale is cached and no free code has to know
         * Pro exists. The import runs Pro → free, which is the one direction
         * ADR 0028 allows.
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
            static function (ServiceContainer $c): TemplateLibrary {
                $vocabulary = $c->resolve(TemplateVocabulary::class);

                return TemplateLibrary::deferred(
                    $vocabulary,
                    static fn (): TemplateLibrary => TemplateLibrary::from(
                        $vocabulary,
                        new BundledTemplates(WCONVERT_DIR),
                        new ProTemplates(WCONVERT_PRO_DIR),
                        new LockedTemplates(WCONVERT_DIR),
                        $c->resolve(\WConvert\Template\Catalog\InstalledPacks::class),
                    )
                );
            }
        );

        // Keep premium setups beside their trees. Free cannot validate a
        // Playbook against a locked metadata-only card, and must not ship the tree.
        $container->register(
            \WConvert\Playbook\PlaybookLibrary::class,
            static fn (ServiceContainer $c): \WConvert\Playbook\PlaybookLibrary => \WConvert\Playbook\PlaybookLibrary::deferred(
                static fn (): \WConvert\Playbook\PlaybookLibrary => \WConvert\Playbook\PlaybookLibrary::fromDirectory(
                    $c->resolve(TemplateLibrary::class),
                    $c->resolve(TemplateVocabulary::class),
                    $c->resolve(RuleVocabulary::class),
                    WCONVERT_DIR,
                    array_merge(
                        (new \WConvert\Pro\Template\ProPlaybooks(WCONVERT_PRO_DIR))->entries(),
                        $c->resolve(\WConvert\Template\Catalog\InstalledPacks::class)->playbooks()
                    )
                )
            )
        );
    }

    public function boot(ServiceContainer $container): void
    {
        if (class_exists(\WConvert\Pro\Module\Analytics\Hooks::class)) {
            (new \WConvert\Pro\Module\Analytics\Hooks(
                new \WConvert\Pro\Module\Analytics\Settings($container->resolve(\WConvert\Storage\OptionStore::class)),
                $container->resolve(PublishedSet::class), $container->resolve(OptinRepository::class),
            ))->hooks();
        }

        if (class_exists(\WConvert\Pro\Module\Destinations\MailchimpDestinationType::class)) {
            $registry = $container->resolve(\WConvert\Destination\DestinationRegistry::class);
            $registry->register(new \WConvert\Pro\Module\Destinations\MailchimpDestinationType());
            $registry->register(new \WConvert\Pro\Module\Destinations\BrevoDestinationType());
        }
        if (class_exists(\WConvert\Pro\Module\SpamFilters\SpamFilters::class)) {
            \WConvert\Pro\Module\SpamFilters\SpamFilters::hooks();
        }
        if (class_exists(\WConvert\Pro\Module\ContentLock\ContentLock::class)) {
            \WConvert\Pro\Module\ContentLock\ContentLock::hooks();
            (new \WConvert\Pro\Module\ContentLock\ContentLockCampaigns(
                $container->resolve(PublishedSet::class),
                $container->resolve(OptinRepository::class),
                $container->resolve(\WConvert\Rules\Degradation::class),
            ))->hooks();
        }
        if (class_exists(\WConvert\Pro\Module\InlinePlacement\AutomaticInline::class)) {
            add_action('init', static function () use ($container): void {
                (new \WConvert\Pro\Module\InlinePlacement\AutomaticInline(
                    $container->resolve(PublishedSet::class),
                    $container->resolve(\WConvert\Rules\Degradation::class),
                    $container->resolve(\WConvert\Targeting\RoleRegistry::class),
                ))->hooks();
            });
        }
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
        // ====================================================================
        // A/B TESTING'S ROUTES, ABOVE THE `is_admin()` GUARD BELOW.
        // ====================================================================
        // `rest_api_init` fires on a request WordPress does not consider
        // wp-admin at all, so registering this inside the guard would register
        // it nowhere. It is the same reasoning free's own controllers are
        // deferred to `rest_api_init` with rather than hooked behind
        // `is_admin()` ({@see \WConvert\Container\CoreServiceProvider}), and
        // the same reasoning the rule registration below sits above the guard.
        if (class_exists(AbTestController::class)) {
            add_action('rest_api_init', static function () use ($container): void {
                $container->resolve(AbTestController::class)->registerRoutes();
            });
        }

        $vocabulary = $container->resolve(RuleVocabulary::class);
        /*
         * AND THE SITE HALF, WHICH IS WHAT #36 CLOSED.
         *
         * Registering every premium type unconditionally was a live hole: on a
         * Pro install with WooCommerce deactivated, `cart_has_items` was
         * SUPPLIED, therefore not suspended, therefore shown — and the Optin
         * said "You left 3 items in your cart" to somebody who has never added
         * anything. That is the failure ADR 0027 exists for, arriving from the
         * WooCommerce side instead of the Pro side, and `on_absence: suspend`
         * alone does not close it because the field only fires when the type
         * is UNSUPPLIED.
         *
         * Being installed is still the whole of the ENTITLEMENT (ADR 0015).
         * This is not a second entitlement question: it is whether Pro's module
         * could answer at all, and with no store nothing writes the cart cookie
         * it reads.
         */
        $site = $container->resolve(SitePresence::class);
        // Every paid build supplies the display-types module.
        add_filter('wconvert_privacy_browser_storage', static function (array $browser): array {
            $browser['reopen_session'] = 'wcv_teaser1:';
            $browser['content_unlock'] = 'wcv_unlock1:';
            return $browser;
        });

        if (class_exists(AbTestController::class)) {
            add_filter('wconvert_privacy_browser_storage', static function (array $browser): array {
                $browser['stores_ab_assignment'] = true;

                return $browser;
            });
        }

        /*
         * ====================================================================
         * ONE PASS PER RUNG THIS BUILD SUPPLIES, AND THE RUNG IS READ OFF DISK.
         * ====================================================================
         * This asked for `Tier::Pro` and nothing else, which was right while
         * "Pro" was the only paid tier. With three (ADR 0056) a Basic build
         * registering `exit_intent` would put a rule in `SuppliedRules` that
         * its own loader bundle cannot evaluate — the Optin would leave the
         * payload unsuspended, reach the page, and never fire, with nothing in
         * any log. That is exactly the silent total loss of function ADR 0012
         * names as this category's defining support ticket.
         *
         * So the ladder is walked, and it stops where this build stops.
         * `installedTier()` is INFERRED from the module directories the build
         * shipped ({@see \WConvert\Support\WpProPresence}), so the question
         * asked here is still "what did this ZIP contain" and never "what does
         * a licence say" — the same possession gate, read one rung finer.
         *
         * Pro names no rule type, at any rung: it asks the ONE manifest both
         * plugins read for the types filed under each tier, exactly as free
         * does for hers. The premium split still adds zero new lists
         * (ADR 0015).
         */
        $installed = $container->resolve(ProPresence::class)->installedTier();

        foreach (Tier::paid() as $tier) {
            if (!$installed->includes($tier)) {
                continue;
            }

            $container->resolve(SuppliedRules::class)->add(...$vocabulary->typesAt($tier, $site));
        }

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
        // AND ONLY WHERE THE MODULE SHIPPED. `cart-recovery` is the top rung's
        // (ADR 0056), so on a Basic or Pro build this class is not on disk at
        // all and Pro's autoloader finds nothing for it. `class_exists()` is
        // therefore the file-system question, not a tier test: it is the same
        // sentence `ProLoaderEnqueue` writes as `is_file($dist)`, and the same
        // one ADR 0015 writes as "a premium capability is absent rather than
        // present and guarded".
        if (class_exists(CartCookie::class) && $site->has(SiteDependency::WooCommerce)) {
            add_filter('wconvert_privacy_browser_storage', [CartCookie::class, 'privacy']);
            $container->resolve(CartCookie::class)->hooks();
        }

        // The same guard free's loader sits behind, and for the same reason:
        // wp-admin is not a page a visitor is looking at. There is deliberately
        // no SECOND condition here — no licence, no entitlement, no "is Pro
        // loaded". This code running IS the answer to that question (ADR 0015),
        // which is what "not one premium feature needs an `if`" means in
        // practice.
        if (is_admin()) {
            // The admin's own replacement is the mirror image, and it hooks on
            // THIS side of the guard: `admin_enqueue_scripts` never fires on a
            // front-end request, so registering it there would be a listener
            // for an event that cannot happen.
            $container->resolve(ProAdminEnqueue::class)->hooks();

            return;
        }

        $container->resolve(ProLoaderEnqueue::class)->hooks();
        $container->resolve(ProInspectorEnqueue::class)->hooks();
    }
}
