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

    /**
     * @param array<string, array{name: string, plugin_name: string, modules: list<string>}> $tiers Slug => what the file says about it.
     */
    private function __construct(private readonly array $tiers)
    {
    }

    public static function load(string $pluginDir = WCONVERT_DIR): self
    {
        $path = rtrim($pluginDir, '/') . '/' . self::PATH;
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
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
                'plugin_name' => is_string($entry['plugin_name'] ?? null) ? $entry['plugin_name'] : '',
                'modules' => array_values(array_filter(is_array($modules) ? $modules : [], 'is_string')),
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
     * **Every rung names its modules, including the top one — there is no
     * `"*"`.** A wildcard reads as "everything", which is true of what the top
     * build should contain and useless to a check: the artifact contract
     * asserts both that a rung carries no module it does not declare AND that
     * it carries every module it does, and against a wildcard the second half
     * asserts nothing — leaving the rung every customer buys today as the one
     * rung with no completeness check (ADR 0056).
     */
    public function shipsModule(Tier $tier, string $module): bool
    {
        return in_array($module, $this->tiers[$tier->value]['modules'] ?? [], true);
    }

    /**
     * What the PRODUCT is called at this tier — *"WConvert Pro"*.
     *
     * Beside {@see self::displayName()} rather than derived from it, because
     * the two are read in different sentences: the badge on a locked card is
     * the short name, and the line under it is *"Available with %s."* A badge
     * reading "WConvert Pro" is a badge that no longer fits, and a sentence
     * reading "Available with Pro." is one that names nothing.
     *
     * Falls back to the short name where the file gives none.
     */
    public function productName(Tier $tier): string
    {
        $name = $this->tiers[$tier->value]['plugin_name'] ?? '';

        return $name !== '' ? $name : $this->displayName($tier);
    }

    /**
     * Every paid rung's words, as the admin bundle receives them.
     *
     * ========================================================================
     * THE ONE PLACE THE ADMIN LEARNS WHAT TO CALL A TIER.
     * ========================================================================
     * Free's admin renders the upsell for a member it does not have, and the
     * word on that card used to be the literal "Pro" in five components. At
     * launch every rung answers "Pro" here, so nothing on screen changes — and
     * splitting the range later is an edit to `tiers.json` rather than five
     * strings and a release (ADR 0056).
     *
     * **The words are not translatable, and that is the trade.** `make-pot`
     * cannot see a JSON string, which is why every other piece of merchant-
     * facing copy in this plugin lives in PHP (ADR 0013). A tier's name is a
     * product name — the thing on the invoice — so it is the one string that
     * should not be translated. The sentence AROUND it stays translatable, with
     * this as its `%s`.
     *
     * @return array<string, array{name: string, product_name: string}>
     */
    public function forTheAdmin(): array
    {
        $tiers = [];

        foreach (Tier::paid() as $tier) {
            $tiers[$tier->value] = [
                'name' => $this->displayName($tier),
                'product_name' => $this->productName($tier),
            ];
        }

        return $tiers;
    }

    /**
     * The modules a tier's build ships, in declaration order.
     *
     * @return list<string>
     */
    public function modulesAt(Tier $tier): array
    {
        return $this->tiers[$tier->value]['modules'] ?? [];
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

    /**
     * The tier a build carrying these modules is at.
     *
     * ========================================================================
     * THE WHOLE INFERENCE, AND IT DOES NOT FAIL OPEN.
     * ========================================================================
     * The highest of each module's lowest supplying tier. A module on disk is
     * evidence of at least the rung that first ships it; the top such rung is
     * what this build is.
     *
     * **The floor is {@see Tier::Basic}, never {@see Tier::Free}, and never the
     * top.** Every unreadable state resolves DOWNWARD: no manifest, no modules,
     * or modules nothing claims, and a loaded Pro reads as the lowest paid rung
     * — which is what "Pro is here and said nothing about itself" honestly
     * means. Reading it as free would show a paying customer upsell cards for
     * what they bought, which ADR 0026 forbids outright; reading it as elite
     * would offer them a feature their ZIP does not contain. The bottom rung is
     * the only answer wrong in the recoverable direction.
     *
     * That is the opposite posture to WSMS's `TierGate`, whose every lookup
     * fails open — ADR 0015 records why: a ladder that fails open is not a
     * ladder.
     *
     * **The caller decides whether Pro is here at all**; this answers only
     * which rung, so it is pure and a test can reach every rung of it.
     *
     * @param list<string> $modules Slugs read off the module directories on disk.
     */
    public function tierFor(array $modules): Tier
    {
        $highest = Tier::Basic;

        foreach ($modules as $module) {
            $supplies = $this->lowestTierSupplying($module);

            if ($supplies !== null && $supplies->includes($highest)) {
                $highest = $supplies;
            }
        }

        return $highest;
    }
}
