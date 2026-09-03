<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * `tiers.json` — the words a merchant reads for a tier, and which modules it
 * ships.
 *
 * =============================================================================
 * WHAT IS IN THE FILE, AND WHAT IS DELIBERATELY NOT.
 * =============================================================================
 * The ORDER of the ladder is {@see Tier}'s, in code, and is not read from here
 * ({@see Tier::ladder()} says why: a ladder that fails open when its file is
 * missing is not a ladder, which is ADR 0015's recorded complaint about WSMS's
 * `TierGate`). What lives here is what only data can carry:
 *
 * - the **display name**, so the one product sold at launch can display as
 *   "Pro" at every rung and splitting the range later is an edit to this file
 *   rather than a code change and a data migration (ADR 0056);
 * - the **module set** per tier, which is what a per-tier build cuts to and
 *   what {@see WpProPresence} infers the installed tier back out of.
 *
 * So every method here has a defined answer when the file is missing, and none
 * of those answers is "you have everything". A tier whose name cannot be read
 * displays as its slug; a module nothing claims supplies nothing.
 * `bin/verify-artifact-contract.sh` is what stops the file being missing in the
 * first place — it is required in the free ZIP, exactly as the rule manifest is.
 *
 * **Free's file, and free's only.** Pro cannot boot without free beside it
 * (`WCONVERT_MIN_CORE`), so a second copy in Pro's ZIP would be a second thing
 * to drift with nothing gained.
 *
 * @since 0.1.0
 */
final class TierManifest
{
    public const PATH = 'tiers.json';

    /** The `modules` value meaning every module there is. */
    private const EVERY_MODULE = '*';

    /**
     * @param array<string, array{name: string, modules: list<string>|string}> $tiers Slug => what the file says about it.
     */
    private function __construct(private readonly array $tiers)
    {
    }

    public static function load(string $pluginDir = WCONVERT_DIR): self
    {
        $path = rtrim($pluginDir, '/') . '/' . self::PATH;
        $raw = is_file($path) && is_readable($path) ? file_get_contents($path) : false;
        $decoded = $raw === false ? null : json_decode($raw, true);

        return self::fromArray(is_array($decoded) ? $decoded : []);
    }

    /**
     * @param array<string, mixed> $decoded The whole file, decoded.
     */
    public static function fromArray(array $decoded): self
    {
        $declared = $decoded['premium']['tiers'] ?? null;
        $tiers = [];

        foreach (is_array($declared) ? $declared : [] as $entry) {
            if (!is_array($entry) || !is_string($entry['slug'] ?? null)) {
                continue;
            }

            $modules = $entry['modules'] ?? [];

            $tiers[$entry['slug']] = [
                'name' => is_string($entry['name'] ?? null) ? $entry['name'] : $entry['slug'],
                'modules' => $modules === self::EVERY_MODULE
                    ? self::EVERY_MODULE
                    : array_values(array_filter(is_array($modules) ? $modules : [], 'is_string')),
            ];
        }

        return new self($tiers);
    }

    /**
     * The tiers this file declares, in the order it declares them.
     *
     * Read only by the parity test, which asserts it is {@see Tier::paid()}.
     * Nothing at runtime takes its ordering from here — see the class note.
     *
     * @return list<string>
     */
    public function declaredSlugs(): array
    {
        return array_keys($this->tiers);
    }

    /**
     * What a merchant is offered when they meet a member this tier supplies.
     *
     * **Every paid tier answers "Pro" at launch**, which is the whole point of
     * the indirection: one product is sold, three are understood, and the
     * `locked → upsell` card names this rather than a hard-coded word
     * (`resources/admin/src/goals/availability.ts`).
     *
     * A tier the file does not name falls back to its own slug — visibly odd
     * on screen, which is the right failure for copy nobody can read.
     */
    public function displayName(Tier $tier): string
    {
        return $this->tiers[$tier->value]['name'] ?? $tier->value;
    }

    /**
     * Whether a tier's build ships a module.
     *
     * The `"*"` wildcard is the top rung's, and it is what keeps a new module
     * from silently being excluded from the tier that is supposed to have
     * everything.
     */
    public function shipsModule(Tier $tier, string $module): bool
    {
        $modules = $this->tiers[$tier->value]['modules'] ?? [];

        return $modules === self::EVERY_MODULE || in_array($module, $modules, true);
    }

    /**
     * The lowest tier whose build ships this module, or null when none does.
     *
     * This is the direction {@see WpProPresence} reads the ladder in, and it is
     * what makes the installed tier INFERRED rather than stored: a module on
     * disk is evidence of at least the tier that first ships it, and the
     * highest such tier across everything installed is what this build is.
     *
     * Spoof-resistant downward by construction — claiming a lower tier costs
     * you the modules — which is the property WP Statistics' `TierGate` has and
     * a stored label does not. Upward it is not resistant at all, and does not
     * need to be: possession is the gate, and a module you do not have supplies
     * nothing however the install is labelled (ADR 0015).
     */
    public function lowestTierSupplying(string $module): ?Tier
    {
        foreach (Tier::paid() as $tier) {
            if ($this->shipsModule($tier, $module)) {
                return $tier;
            }
        }

        return null;
    }
}
