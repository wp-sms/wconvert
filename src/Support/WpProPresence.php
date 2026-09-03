<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Which tier is installed, read off the modules [[Pro]]'s build left on disk.
 *
 * =============================================================================
 * TWO QUESTIONS, IN ORDER, AND NEITHER OF THEM IS A LICENCE.
 * =============================================================================
 * 1. **Is Pro loaded at all?** `WCONVERT_PRO_LOADED` is defined by Pro's
 *    bootstrap and only after its min-core guard passed, so a Pro that refused
 *    to boot reads here exactly as a Pro that is not installed — which is what
 *    the merchant is in fact getting (ADR 0015).
 * 2. **Which tier is it?** Not stored, and not asked of a server: it is
 *    INFERRED from the module directories the build shipped, mapped through
 *    `tiers.json` to the lowest tier that ships each, taking the highest.
 *
 * Inference rather than a stored label is WP Statistics' `TierGate` shape and
 * it is chosen for the property it has: **spoofing downward costs you the
 * modules.** Upward it is not resistant, and does not need to be — possession
 * is the gate, so a module you do not have supplies nothing whatever the
 * install claims to be. It also needs no new storage, which matters: CLAUDE.md
 * requires sign-off before a table, a column or an option is added, and a tier
 * that is a fact about the file system is a tier nothing has to migrate.
 *
 * =============================================================================
 * AND IT DOES NOT FAIL OPEN.
 * =============================================================================
 * ADR 0015 records WSMS's cautionary case: its shipped elite ZIP is missing the
 * `tiers.json` its own `TierGate` reads, benign only because every lookup fails
 * open — "and a ladder that fails open is not a ladder". Every unreadable state
 * here resolves DOWNWARD instead: no manifest, no modules directory, or modules
 * nothing claims, and a loaded Pro reads as {@see Tier::Basic} — the lowest
 * paid rung, which is what "Pro is here and said nothing about itself" honestly
 * means.
 *
 * That floor is deliberate rather than a default. Reading a loaded Pro as
 * {@see Tier::Free} would show a paying customer upsell cards for what they
 * bought, which ADR 0026 forbids outright; reading it as {@see Tier::Elite}
 * would offer them a feature their ZIP does not contain. The bottom rung is
 * the only answer that is wrong in the recoverable direction, and Pro's own
 * ZIP is checked for its modules before it is written
 * (`bin/verify-artifact-contract.sh`), so an install reaching this floor is one
 * whose files went missing after the build.
 *
 * @since 0.1.0
 */
final class WpProPresence implements ProPresence
{
    /** Where Pro's build leaves its modules, relative to Pro's plugin directory. */
    private const MODULES = 'modules';

    private ?Tier $installed = null;

    /**
     * @param TierManifest|null $manifest Free's `tiers.json`; loaded on first
     *                                    ask when not supplied, so a free
     *                                    install never reads the file at all.
     */
    public function __construct(private ?TierManifest $manifest = null)
    {
    }

    public function installedTier(): Tier
    {
        // Memoised because the registries ask it once per member and the
        // answer is a directory listing. It cannot change within a request:
        // both halves are settled before `plugins_loaded` finishes.
        return $this->installed ??= $this->infer();
    }

    private function infer(): Tier
    {
        if (!defined('WCONVERT_PRO_LOADED') || !defined('WCONVERT_PRO_DIR')) {
            return Tier::Free;
        }

        $manifest = $this->manifest ??= TierManifest::load();

        // Two halves, and only the first needs WordPress: this reads the
        // constants and the file system, and {@see TierManifest::tierFor()}
        // does the arithmetic. That split is what lets the ladder be tested at
        // every rung — a suite cannot define WCONVERT_PRO_LOADED without
        // deciding the answer for every test that runs after it.
        return $manifest->tierFor($this->installedModules((string) constant('WCONVERT_PRO_DIR')));
    }

    /**
     * The module slugs on disk.
     *
     * A module is a DIRECTORY holding a `module.json` that names it, so what is
     * read is what a build actually left behind — never a list somebody wrote.
     * The slug comes out of the file rather than off the directory name, so a
     * directory renamed by an unpacker cannot quietly become a different
     * module; a file that will not decode, or names nothing, is not a module.
     *
     * @return list<string>
     */
    private function installedModules(string $proDir): array
    {
        $manifests = glob(rtrim($proDir, '/') . '/' . self::MODULES . '/*/module.json');
        $slugs = [];

        foreach ($manifests === false ? [] : $manifests as $file) {
            $raw = is_readable($file) ? file_get_contents($file) : false;
            $decoded = $raw === false ? null : json_decode($raw, true);
            $slug = is_array($decoded) ? ($decoded['slug'] ?? null) : null;

            if (is_string($slug) && $slug !== '') {
                $slugs[] = $slug;
            }
        }

        return $slugs;
    }
}
