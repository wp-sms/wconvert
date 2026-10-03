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
use WConvert\Targeting\RoleRegistry;

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
     * ========================================================================
     * BEFORE {@see LoaderEnqueue}, AND THE ORDER IS A CORRECTNESS BUG THAT WAS
     * FOUND ON A REAL PAGE.
     * ========================================================================
     * Footer scripts execute in the order they were enqueued, and free's
     * loader `boot()`s at module scope — so by the time a script enqueued
     * AFTER it runs, the loader has already decided, already shown whatever it
     * was going to show, and already written that impression to the visitor's
     * device.
     *
     * The inspector read the allowance after that, and an Optin with
     * `maxImpressions: 1` that was **on screen at that moment** reported *"this
     * browser has already had its allowance"*. True about the next page view,
     * and exactly backwards as an answer to *"why didn't it show"*.
     *
     * Running first is what makes the panel's question — *as this page view
     * began* — a fact rather than nearly one. It reads its own tag and the
     * payload tag, both of which are printed in `wp_head` and are in the
     * document long before either bundle executes, so nothing about running
     * earlier costs it anything.
     *
     * Pro replaces the loader on this same hook at `LoaderEnqueue::PRIORITY + 10`
     * and replaces the inspector at `self::PRIORITY + 10`, which still lands
     * before Pro's loader — see `WConvert\Pro\Frontend\ProInspectorEnqueue`.
     */
    public const PRIORITY = LoaderEnqueue::PRIORITY - 1;

    /**
     * `wp_head` priority, after {@see LoaderEnqueue}'s payload at 5.
     *
     * Independent of {@see self::PRIORITY} above: both callbacks are
     * registered during `wp_enqueue_scripts` and `wp_head` sorts them itself,
     * so this one prints second however the two enqueues were ordered. The
     * panel needs both tags and reads them once; the payload is the document
     * of record and reading it in DOM order is one fewer thing to be careful
     * about.
     */
    private const HEAD_PRIORITY = 6;

    private const DIST = 'public/inspector/inspector.js';

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly PublishedSet $publishedSet,
        private readonly Degradation $degradation,
        private readonly RuleCatalogue $rules,
        // The same registry the loader's path uses, so the panel reports the
        // roles the page was actually decided against rather than a second
        // reading of them.
        private readonly RoleRegistry $roles,
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
            // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- the page caches' shared convention; it has to be this name to be read.
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

        // **The clock is read here, on a request that reached PHP.** This one
        // is uncached by construction — `DONOTCACHEPAGE` above, and the
        // capability check before it — so "3 days" is 3 days as of now rather
        // than as of whenever a cache last filled.
        $schedules = InspectorSchedules::forSet($set, time());

        // The same context the payload was decided against: term resolution is
        // conditional on the published set for the reason it always was, so
        // asking again here costs a page with no term rule nothing.
        $context = RequestContextFactory::forPublishedSet(PublishedOptin::fromSet($set), $this->roles);
        $labels = InspectorLabels::all();

        add_action('wp_head', static function () use ($summaries, $suspensions, $schedules, $set, $context, $labels): void {
            // Not escaped, and correctly so — the same argument PayloadTag
            // carries one file over: JSON_HEX_TAG is the escaping this context
            // needs, and esc_html() over it would produce invalid JSON that
            // fails silently in the browser. There is no URL on this tag, so
            // there is nothing here for esc_url() either.
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- InspectorTag::render() escapes for this context with JSON_HEX_TAG; the tag carries no URL.
            echo InspectorTag::render($summaries, $suspensions, $schedules, $set, $context, $labels);
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
