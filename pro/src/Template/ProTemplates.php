<?php

namespace WConvert\Pro\Template;

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
     * Pro's library, at the same relative path free's is.
     *
     * Spelled here rather than read off `BundledTemplates::PATH`, because they
     * are the same path by coincidence of layout rather than by contract:
     * `bin/verify-artifact-contract.sh` checks each ZIP against its own tree,
     * and the day Pro's designs move, this is the one line that says so.
     */
    public const PATH = 'resources/templates/library';

    public function __construct(
        private readonly string $pluginDir = WCONVERT_PRO_DIR,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function entries(): array
    {
        $files = glob(rtrim($this->pluginDir, '/') . '/' . self::PATH . '/*.json');
        $entries = [];

        foreach ($files === false ? [] : $files as $file) {
            $decoded = JsonFile::read($file);

            if ($decoded !== null) {
                $entries[] = $decoded;
            }
        }

        return $entries;
    }
}
