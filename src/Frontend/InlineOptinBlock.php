<?php

namespace WConvert\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Optin\DisplayType;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;

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
     * Where the editor finds the site's published inline Optins.
     *
     * On `window` rather than fetched, and the argument for that is in
     * `resources/blocks/inline-optin/src/optins.ts` beside the reader.
     */
    public const DATA = 'wconvertInlineOptins';

    private const METADATA = 'resources/blocks/inline-optin';

    private const DIST = 'public/blocks/inline-optin.js';

    /**
     * What WordPress ships to the editor that this bundle imports instead of
     * carrying.
     *
     * `wp-element` is the editor's React and is why the bundle compiles JSX
     * with the classic runtime (`vite.config.block.mjs`); the other four are
     * the surface the placeholder is built from. Declared as dependencies so
     * WordPress prints them first — an IIFE reading `wp.blocks` at execution
     * time is a `TypeError` in an editor that has not loaded it yet.
     */
    private const EDITOR_DEPENDENCIES = [
        'wp-blocks',
        'wp-block-editor',
        'wp-components',
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

        wp_set_script_translations(self::HANDLE, 'wconvert');

        // The metadata directory, plus the one thing metadata cannot carry.
        // Everything else about this block — its name, its category, its one
        // attribute — is declared in `block.json` and read by the editor
        // bundle from the same file, so there is no second spelling to drift.
        register_block_type(WCONVERT_DIR . self::METADATA, [
            'render_callback' => [self::class, 'render'],
        ]);

        // Only where a block can be placed. This reads an option and runs a
        // query, and `init` fires on every request of every install — so the
        // list is built on the editor's own hook rather than beside the
        // registration above.
        add_action('enqueue_block_editor_assets', [$this, 'provideTheOptinList']);
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
            'window.' . self::DATA . ' = ' . (string) wp_json_encode($this->publishedInlineOptins()) . ';',
            'before'
        );
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
            $payload = $optin->toPayloadEntry();

            // Absence is `popup` on both sides of the wire, which is what
            // makes this a positive test rather than a "not one of the other
            // three": an entry naming a placement nothing recognises is
            // dropped at the write, so what is left here is either a word this
            // build has or none at all ({@see DisplayType}).
            if (DisplayType::of($payload['display_type'] ?? null) !== DisplayType::Inline) {
                continue;
            }

            $inline[] = [
                'id' => $optin->id,
                // An Optin with no name is not a case this can drop: it is in
                // the set, it renders on the page, and a picker that omits it
                // is a picker that cannot place something the site is serving.
                'name' => ($names[$optin->id] ?? '') !== ''
                    ? $names[$optin->id]
                    : $optin->id,
            ];
        }

        usort($inline, static fn (array $a, array $b): int => strcmp($b['id'], $a['id']));

        return $inline;
    }
}
