<?php

namespace WConvert\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\Suspension;
use WConvert\Rest\Routes;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleCatalogue;

defined('ABSPATH') || exit;

/**
 * The eligibility inspector: **the merchant does not describe a page, they
 * visit it**.
 *
 * ============================================================================
 * THE DECISION THAT SHAPES THE WHOLE FEATURE.
 * ============================================================================
 * {@see RequestContextFactory} cannot build a {@see \WConvert\Targeting\RequestContext}
 * from a URL and must not be made to. All seven of its fields come from
 * conditional tags about *the current query*, and `path()` reads
 * `$_SERVER['REQUEST_URI']`. Every way of faking one is dishonest exactly
 * where merchants ask:
 *
 * - `url_to_postid()` returns 0 for archives, terms, the blog index and the
 *   WooCommerce shop page, so `archivePostType` would be permanently null;
 * - a loopback request breaks on staging, on basic auth, and cannot render the
 *   signed-out variant from a signed-in session;
 * - faking the main query means re-implementing WordPress's rewrite
 *   resolution, which is the thing WordPress is.
 *
 * So an admin opens `https://site/whatever?wconvert-inspect=1` and the context
 * is not *equivalent to* the served one — it **is** it. The real loader runs
 * beside the panel, unaware of it, so the merchant watches the popup actually
 * fire while reading why.
 *
 * ============================================================================
 * NO REST ROUTE, AND THAT IS LOAD-BEARING.
 * ============================================================================
 * Four tests assert exact route counts and `CoreServiceProvider::REST_CONTROLLERS`
 * is asserted complete; inlining the server half here moves none of them. And
 * `current_user_can()` at enqueue already answers the permission question that
 * a route's `permission_callback` would — on a request that is being rendered
 * for this user rather than fetched by a page that may itself be cached.
 *
 * ============================================================================
 * A DEBUG MODE IN THE SHIPPED LOADER WAS REJECTED ON THE LEAK, NOT THE BYTES.
 * ============================================================================
 * `window.wconvert.candidates` behind a guessable query parameter exposes
 * campaign ids and rule state on a page that may sit in a public full-page
 * cache, and a capability check cannot rescue it: `Routes::canCapture()`
 * already records why nothing baked into a cached page authenticates anyone.
 * Here the capability is checked in PHP, on an uncached request, before a
 * single byte is printed.
 *
 * @since 0.1.0
 */
final class InspectorEnqueue
{
    public const HANDLE = 'wconvert-inspector';

    /** The query parameter that asks for it. */
    public const PARAM = 'wconvert-inspect';

    /**
     * After {@see LoaderEnqueue}, always.
     *
     * The panel reads the ordinary payload tag rather than a copy of it, so
     * the payload has to have been decided first. Pro replaces the loader on
     * this same hook at `LoaderEnqueue::PRIORITY + 10`, and replaces the
     * inspector at `self::PRIORITY + 10` for the same reason — see
     * `WConvert\Pro\Frontend\ProInspectorEnqueue`.
     */
    public const PRIORITY = LoaderEnqueue::PRIORITY + 1;

    /**
     * `wp_head` priority, after {@see LoaderEnqueue}'s payload at 5.
     *
     * The panel needs both tags and reads them once; printing this first would
     * work, but the payload is the document of record and reading it in DOM
     * order is one fewer thing to be careful about.
     */
    private const HEAD_PRIORITY = 6;

    private const DIST = 'public/loader/inspector.js';

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly PublishedSet $publishedSet,
        private readonly Degradation $degradation,
        private readonly RuleCatalogue $rules,
    ) {
    }

    public function hooks(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'enqueue'], self::PRIORITY);
    }

    public function enqueue(): void
    {
        if (!self::asked()) {
            return;
        }

        // ====================================================================
        // TELL EVERY CACHE TO LEAVE THIS ALONE — AND KNOW WHY IT MAY BE TOO
        // LATE.
        // ====================================================================
        // This runs during PHP, and a full-page cache that already holds a
        // file for this URL answers BEFORE PHP runs at all. In practice the
        // `wordpress_logged_in` cookie bypasses full-page cache in every
        // mainstream plugin — which is why the admin bar works on the front
        // end — so this is the belt on a request that had to reach PHP to get
        // here. Where a host caches for signed-in visitors too, the symptom is
        // no panel AND no admin bar, and
        // {@see InspectorLabels::all()}'s `cache_warning` is where that is
        // said, on the screen that offers the link.
        nocache_headers();

        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }

        $dist = WCONVERT_DIR . self::DIST;

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

        $set = $this->publishedSet->all();

        // EVERY Optin, including the drafts — the funnel's first gate is
        // *published*, and it is the commonest answer of all.
        $summaries = $this->optins->summaries();
        $suspensions = Suspension::reasonsIn($set, $this->degradation, $this->rules);

        // The same context the payload was decided against: term resolution is
        // conditional on the published set for the reason it always was, so
        // asking again here costs a page with no term rule nothing.
        $context = RequestContextFactory::forPublishedSet(PublishedOptin::fromSet($set));
        $labels = InspectorLabels::all();

        add_action('wp_head', static function () use ($summaries, $suspensions, $set, $context, $labels): void {
            // Not escaped, and correctly so — the same argument PayloadTag
            // carries one file over: JSON_HEX_TAG is the escaping this context
            // needs, and esc_html() over it would produce invalid JSON that
            // fails silently in the browser. There is no URL on this tag, so
            // there is nothing here for esc_url() either.
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- InspectorTag::render() escapes for this context with JSON_HEX_TAG; the tag carries no URL.
            echo InspectorTag::render($summaries, $suspensions, $set, $context, $labels);
        }, self::HEAD_PRIORITY);
    }

    /**
     * Has an administrator asked for this, on a page a visitor is looking at?
     *
     * ========================================================================
     * THE CAPABILITY IS CHECKED FIRST AND IT IS NOT NEGOTIABLE.
     * ========================================================================
     * A logged-out visitor and a subscriber get **no tag and no script** —
     * not a hidden panel, not an empty one. The report names every Optin on
     * the site, published or draft, with the rules behind each; it is the
     * single richest thing this plugin could accidentally print on a public
     * page.
     *
     * `Routes::MANAGE_CAPABILITY` rather than a literal, so the inspector and
     * the admin screens can never disagree about who may see this.
     *
     * The parameter is only read for presence. Nothing is done with its value,
     * so there is nothing to sanitise beyond that — and a nonce would be
     * wrong here rather than merely absent: this is a link a merchant is meant
     * to be able to type, bookmark and paste to a colleague, and it changes
     * nothing on the site.
     */
    private static function asked(): bool
    {
        if (is_admin() || is_feed() || is_robots() || is_embed()) {
            return false;
        }

        if (!current_user_can(Routes::MANAGE_CAPABILITY)) {
            return false;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- A read-only diagnostic gated on manage_options; presence only, no value is read.
        return isset($_GET[self::PARAM]);
    }
}
