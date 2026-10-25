<?php

namespace WConvert\Pro\Template;

use WConvert\Template\BundledArtwork;
use WConvert\Template\JsonFile;
use WConvert\Template\TemplateSource;

defined('ABSPATH') || exit;

/**
 * The designs in PRO's ZIP: one directory of JSON files, rooted under Pro.
 *
 * ============================================================================
 * THE SEAM WAS EXTRACTED FOR THIS AND THEN NOBODY PLUGGED ANYTHING INTO IT.
 * ============================================================================
 * {@see TemplateSource}'s own docblock names *"Pro's own designs"* as the first
 * of four reasons the glob became an interface — and until this class existed,
 * `TemplateLibrary::fromDirectory()` was the only composer anybody called and
 * it hard-coded two sources rooted at `WCONVERT_DIR`. So a Pro install shipped
 * six bar and slide-in designs' worth of *cards* and none of the designs, which
 * is the free artifact's behaviour on the install that paid to be different.
 *
 * It also had a second cost, and that one is a rule rather than a gap.
 * `TemplateLibrary::locked()` drops a stub whose id a registered entry already
 * holds, which is how *"a paying customer is never shown an advertisement for
 * what they bought"* (ADR 0026) is meant to fall out of the id rather than out
 * of a tier test. With nothing registering the real trees, `array_diff_key`
 * dropped nothing and a Pro customer was shown a **Pro badge** on every locked
 * card. `tests/unit/Pro/Template/ProLibraryTest.php` is that rule asserted
 * instead of documented.
 *
 * ============================================================================
 * IT MIRRORS `BundledTemplates` AND DOES NOT SUBCLASS IT.
 * ============================================================================
 * The two differ in exactly one thing — which plugin directory they are rooted
 * at — and free's is `final`, deliberately: this is Pro reaching into free
 * through a published interface, which is the one direction the split allows
 * (ADR 0028). Fifteen lines against a class free would have to open up is the
 * right trade, and the shared half that actually matters — decoding a file
 * without ever throwing — is {@see JsonFile}, which both call.
 *
 * @since 0.1.0
 */
final class ProTemplates implements TemplateSource
{
    /**
     * Pro's designs, wherever an installed MODULE keeps them.
     *
     * ========================================================================
     * A GLOB ACROSS MODULES.
     * ========================================================================
     * This read `resources/templates/library`, one directory. Designs live in
     * the module that owns them now (ADR 0056), so this is a glob across
     * `modules/`: what Pro offers is what its own file system answers here —
     * never a tier compared against a declaration.
     *
     * A Pro ZIP missing a module would find none of its designs and show the
     * same locked cards free shows, which is the failure
     * `bin/verify-artifact-contract.sh` refuses to write a ZIP for.
     *
     * Spelled here rather than read off `BundledTemplates::PATH`: free keeps
     * one library at a fixed path and Pro keeps one per module, so the two are
     * no longer even the same shape.
     */
    public const PATH = 'modules/*/templates';
    public const REVISIONS = 'resources/templates/revisions.json';

    public function __construct(
        private readonly string $pluginDir = WCONVERT_PRO_DIR,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function entries(): array
    {
        // GLOB_BRACE is not portable and is not needed: the wildcard is a
        // single path segment, which plain glob() expands. It returns false on
        // failure and an empty array on no match, and both mean the same thing
        // to a caller — this install has no premium design — so the branch
        // below reads them the same way.
        $files = glob(rtrim($this->pluginDir, '/') . '/' . self::PATH . '/*.json');
        $entries = [];

        foreach ($files === false ? [] : $files as $file) {
            $decoded = JsonFile::read($file);

            if ($decoded === null) continue;
            try {
                // Pro's photographs ship as files beside its designs, so a
                // campaign carries a cacheable URL rather than the photo.
                $entries[] = BundledArtwork::forSite($decoded, $this->pluginDir, defined('WCONVERT_PRO_URL') ? WCONVERT_PRO_URL : '');
            } catch (\RuntimeException) {
                // A design whose photo is missing from the ZIP is left out; the rest still list.
                continue;
            }
        }

        // Pro's designs' names, in Pro's domain (`bin/template-labels.mjs`).
        $entries = \WConvert\Template\TemplateNames::apply($entries, rtrim($this->pluginDir, '/') . '/resources/templates/labels.php');

        return \WConvert\Template\BundledRevisions::stamp($entries, \WConvert\Template\BundledRevisions::read(rtrim($this->pluginDir, '/') . '/' . self::REVISIONS));
    }
}
