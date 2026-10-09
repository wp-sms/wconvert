<?php

namespace WConvert\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Optin\DisplayType;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;

defined('ABSPATH') || exit;

/**
 * `wconvert/inline-optin` — the block a merchant drops into a post to place an
 * `inline` [[Optin]].
 *
 * ============================================================================
 * A REAL BLOCK, NOT A SHORTCODE IN A WRAPPER.
 * ============================================================================
 * The difference that matters is the picker. A wrapper would ask a merchant to
 * paste a ULID into a text field — a 26-character identifier that exists
 * nowhere in their working memory, is not shown anywhere they would think to
 * look, and gives no feedback when it is one character wrong. This offers the
 * Optins they published, **by the names they gave them**, which is the only
 * form of this question anybody can answer.
 *
 * ============================================================================
 * IT RENDERS FROM THE SERVER, AND SHARES ONE LINE WITH THE SHORTCODE.
 * ============================================================================
 * `save` returns null in the editor, so nothing is serialised into post
 * content and {@see InlineAnchor} is the one place either surface's element is
 * written. That is what makes the anchor a contract rather than a convention:
 * `tests/unit/Frontend/InlineAnchorTest.php` compares the two outputs, and
 * there would be nothing to compare if half of one lived in a database column.
 *
 * @since 0.1.0
 */
final class InlineOptinBlock
{
    /** Spelled in `resources/blocks/inline-optin/block.json` too, and read from there. */
    public const NAME = 'wconvert/inline-optin';

    /**
     * The editor script's handle, named in `block.json` as its `editorScript`.
     *
     * A registered handle rather than a `file:./…` path, because the built
     * bundle does not sit beside the metadata: sources live under
     * `resources/` and Vite writes to `public/`, which is the layout every
     * other asset this plugin serves already has. Registering it here is also
     * what lets {@see BuiltAsset} cache-bust it on mtime, like the rest.
     */
    public const HANDLE = 'wconvert-inline-optin';

    /**
     * Where the editor finds the site's inline campaigns.
     *
     * On `window` at load, so the picker draws without a round trip; the
     * reader is `resources/blocks/inline-optin/src/optins.ts`.
     */
    public const DATA = 'wconvertInlineOptins';

    /**
     * The same list again, for the picker's Refresh.
     *
     * A merchant publishes an inline campaign in another tab and comes back:
     * without this, the block says "none" until the editor is reloaded. It
     * mirrors Pro's `/content-lock-campaigns` read, capability included.
     */
    public const ROUTE = '/inline-campaigns';

    private const METADATA = 'resources/blocks/inline-optin';

    private const DIST = 'public/blocks/inline-optin.js';

    /**
     * The picker's stylesheet, emitted by the same Vite run as the bundle
     * (`cssFileName` in `vite.config.block.mjs`), so one cannot exist without
     * the other. Registered under the script's handle and named in
     * `block.json` as the `editorStyle`; Pro's content lock style depends on it.
     */
    private const DIST_STYLE = 'public/blocks/inline-optin.css';

    /**
     * What WordPress ships to the editor that this bundle imports instead of
     * carrying.
     *
     * `wp-element` is the editor's React and is why the bundle compiles JSX
     * with the classic runtime (`vite.config.block.mjs`); `wp-api-fetch` is
     * the picker's Refresh and `wp-compose` its shortcode Copy; the rest are
     * the surface the placeholder is built from. Declared as dependencies so
     * WordPress prints them first — an IIFE reading `wp.blocks` at execution
     * time is a `TypeError` in an editor that has not loaded it yet.
     */
    private const EDITOR_DEPENDENCIES = [
        'wp-api-fetch',
        'wp-blocks',
        'wp-block-editor',
        'wp-components',
        'wp-compose',
        'wp-element',
        'wp-i18n',
    ];

    public function __construct(
        private readonly PublishedSet $publishedSet,
        private readonly OptinRepository $optins,
    ) {
    }

    /**
     * Register the block, on `init` and never before it.
     *
     * `register_block_type()` reads `block.json` and translates its `title` and
     * `description` through the i18n schema, so registering on `plugins_loaded`
     * asks WordPress to translate before there is a text domain to translate
     * against — which is #52 exactly: `_load_textdomain_just_in_time was called
     * incorrectly`, printed mid-`plugins_loaded`, so output begins before
     * `<!DOCTYPE html>` and nothing after it can set a header. The strings do
     * not come back translated either.
     */
    public function register(): void
    {
        $dist = WCONVERT_DIR . self::DIST;

        /*
         * ====================================================================
         * UNCONDITIONAL, AND A MISSING BUNDLE DOES NOT CHANGE THAT.
         * ====================================================================
         * The obvious guard here is `is_file($dist) || return`, and it is
         * backwards. **An unregistered dynamic block renders nothing**, so
         * skipping registration on a checkout with no build does not degrade
         * the editor — it takes the Optin off every page that already carries
         * this block, on the front end, for visitors. Registering with a
         * script that 404s costs one broken block in the editor and leaves
         * every saved one rendering.
         *
         * Where a missing bundle is actually caught is the release:
         * `bin/verify-artifact-contract.sh` fails closed on it before a ZIP
         * exists, beside the loader, the inspector and the two admin chunks.
         * {@see BuiltAsset::version()} falls back to the plugin version when
         * the file is not there, so nothing here needs to ask twice.
         */
        wp_register_script(
            self::HANDLE,
            WCONVERT_URL . self::DIST,
            self::EDITOR_DEPENDENCIES,
            BuiltAsset::version($dist),
            true
        );

        wp_register_style(
            self::HANDLE,
            WCONVERT_URL . self::DIST_STYLE,
            [],
            BuiltAsset::version(WCONVERT_DIR . self::DIST_STYLE)
        );

        wp_set_script_translations(self::HANDLE, 'wconvert');

        // The metadata directory, plus the one thing metadata cannot carry.
        // Everything else about this block — its name, its category, its one
        // attribute — is declared in `block.json` and read by the editor
        // bundle from the same file, so there is no second spelling to drift.
        register_block_type(WCONVERT_DIR . self::METADATA, [
            // All supported WordPress versions provide block API v3.
            'api_version' => 3,
            'render_callback' => [self::class, 'render'],
        ]);

        // Only where a block can be placed. This reads an option and runs a
        // query, and `init` fires on every request of every install — so the
        // list is built on the editor's own hook rather than beside the
        // registration above.
        add_action('enqueue_block_editor_assets', [$this, 'provideTheOptinList']);
        add_action('rest_api_init', [$this, 'registerRoute']);
    }

    /**
     * The picker's Refresh: a GET, answered fresh every time.
     *
     * `no-store` because the whole point of the read is that the list changed
     * since the page loaded; a cached answer is the stale one it replaces.
     */
    public function registerRoute(): void
    {
        register_rest_route(Routes::NAMESPACE, self::ROUTE, [
            'methods' => 'GET',
            'permission_callback' => [Routes::class, 'canPlaceCampaign'],
            'callback' => fn (): \WP_REST_Response => new \WP_REST_Response($this->choices(), 200, ['Cache-Control' => 'no-store']),
        ]);
    }

    /**
     * The anchor for the Optin this block names.
     *
     * Static, and a pure function of its argument, for the reason
     * {@see LoaderEnqueue::withCartUrl()} is: it is the half of this class a
     * unit suite can hold to the shortcode's output, and everything around it
     * is WordPress calls that suite cannot make.
     *
     * @param array<string, mixed> $attributes The block's saved attributes.
     */
    public static function render(array $attributes): string
    {
        return InlineAnchor::html((string) ($attributes['optinId'] ?? ''));
    }

    /**
     * Hand the editor the list its picker is built from.
     *
     * `'before'`, so the data is on `window` by the time the bundle's IIFE
     * runs. `wp_add_inline_script` writes a classic `<script>` that executes
     * where it is printed, which is immediately above the handle it is
     * attached to.
     */
    public function provideTheOptinList(): void
    {
        wp_add_inline_script(
            self::HANDLE,
            'window.' . self::DATA . ' = ' . (string) wp_json_encode($this->choices()) . ';',
            'before'
        );
    }

    /**
     * What the picker is built from: the campaigns, and the doors out of it.
     *
     * ========================================================================
     * DRAFTS ARE LISTED, AND THE EDITOR REFUSES THEM WITH THE REASON.
     * ========================================================================
     * A first-time owner builds an inline form, saves a draft and goes to
     * place it. A list of published campaigns alone says "none", which
     * contradicts what they just did; listing the draft as a choice that says
     * "publish to place it" names the one step left (GUIDELINES §8). They are
     * not placeable because an anchor for an unpublished campaign renders
     * nothing, and the block would look placed.
     *
     * **The links are a manager's only.** An Author can open the post editor
     * and place this block, but cannot open WConvert, so a "Create" or "Edit"
     * link would be a door that opens onto "Sorry, you are not allowed". Null
     * tells the editor to say who can instead.
     *
     * @return array{campaigns: list<array{id: string, name: string, status: string, editUrl: ?string}>, manageUrl: ?string, createUrl: ?string}
     */
    public function choices(): array
    {
        $manage = Routes::canManage();
        $editUrl = static fn (string $id): ?string => $manage
            ? admin_url('admin.php?page=wconvert#optins?edit=' . rawurlencode($id))
            : null;
        $campaigns = [];

        foreach ($this->publishedInlineOptins() as $optin) {
            $campaigns[] = ['id' => $optin['id'], 'name' => $optin['name'], 'status' => 'published', 'editUrl' => $editUrl($optin['id'])];
        }

        foreach ($this->optins->draftsOfType(DisplayType::Inline) as $draft) {
            $campaigns[] = [
                'id' => $draft['id'],
                'name' => $draft['name'],
                'status' => 'draft',
                'editUrl' => $editUrl($draft['id']),
            ];
        }

        return [
            'campaigns' => $campaigns,
            'manageUrl' => $manage ? admin_url('admin.php?page=wconvert#optins') : null,
            'createUrl' => $manage ? admin_url('admin.php?page=wconvert#optins?new=1') : null,
        ];
    }

    /**
     * Every published `inline` Optin on this site, by name, newest first.
     *
     * ========================================================================
     * READ FROM THE PUBLISHED SET, WHICH IS THE ONE PLACE THAT KNOWS.
     * ========================================================================
     * *Published* and *`inline`* are two questions and neither is answerable
     * from the Optins list on its own: `OptinRepository::SUMMARY_COLUMNS`
     * deliberately reads no LONGTEXT, and the [[Display Type]] lives inside
     * `published_config` (ADR 0001). The published set already holds the
     * projection of exactly the Optins this site is serving, keyed by id, with
     * `display_type` on the payload — so this asks the option that was built
     * for that question rather than dragging two blob columns per row into
     * wp-admin.
     *
     * What the set does NOT carry is the name, because the browser has no use
     * for one and the payload is inlined into every matching page. So the
     * names come from {@see OptinRepository::names()}, which is two short
     * columns and the same read the [[Lead]] log labels its rows with.
     *
     * **A [[Suspended]] Optin is included, deliberately.** It is published; it
     * is not being served today because Pro or WooCommerce is not loaded, and
     * it resumes on its own when the dependency returns (ADR 0027). Hiding it
     * would take a merchant's working block away over a plugin they are about
     * to reactivate, and the editor's own warning is for an id that is GONE
     * rather than one that is paused.
     *
     * Newest first — the id is a ULID, so ordering by it is ordering by the
     * moment it was created, which is the order the Optins list already shows.
     *
     * @return list<array{id: string, name: string}>
     */
    private function publishedInlineOptins(): array
    {
        $names = $this->optins->names();
        $inline = [];

        foreach (PublishedOptin::fromSet($this->publishedSet->all()) as $optin) {
            // Asked of the Optin rather than read out of the entry it would
            // send to the browser. Absence is `popup` on both sides of the
            // wire, which is what makes this a positive test rather than a
            // "not one of the other three": an entry naming a placement
            // nothing recognises is dropped at the write, so what is left here
            // is either a word this build has or none at all
            // ({@see DisplayType}).
            if ($optin->displayType() !== DisplayType::Inline) {
                continue;
            }

            $inline[] = [
                'id' => $optin->id,
                // An Optin with no name is not a case this can drop: it is in
                // the set, it renders on the page, and a picker that omits it
                // is a picker that cannot place something the site is serving.
                // It goes out nameless and the editor says "Unnamed campaign":
                // no ID on screen (ADR 0131 decision 4).
                'name' => $names[$optin->id] ?? '',
            ];
        }

        usort($inline, static fn (array $a, array $b): int => strcmp($b['id'], $a['id']));

        return $inline;
    }
}
