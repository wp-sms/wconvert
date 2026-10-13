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
 * The tiers themselves are {@see Tier}'s, in code, and are not read from here:
 * a tier list that fails open when its file is missing is ADR 0015's recorded
 * complaint about WSMS's `TierGate`. What lives here is what only data can
 * carry:
 *
 * - the **display name** and **product name** the admin shows on a `locked`
 *   card;
 * - the **module set** Pro ships, which `bin/verify-artifact-contract.sh`
 *   proves the Pro ZIP carries in full.
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
     * @param array<string, array{name: string, plugin_name: string, modules: list<string>, destinations: list<string>}> $tiers Slug => what the file says about it.
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
            $destinations = $entry['destinations'] ?? [];

            $tiers[$entry['slug']] = [
                'name' => is_string($entry['name'] ?? null) ? $entry['name'] : $entry['slug'],
                'plugin_name' => is_string($entry['plugin_name'] ?? null) ? $entry['plugin_name'] : '',
                'modules' => array_values(array_filter(is_array($modules) ? $modules : [], 'is_string')),
                'destinations' => array_values(array_filter(is_array($destinations) ? $destinations : [], 'is_string')),
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
     * The `locked → upsell` card names this rather than a hard-coded word
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
     * **Pro names its modules — there is no `"*"`.** A wildcard reads as
     * "everything", which is true of what the build should contain and useless
     * to a check: the artifact contract asserts the Pro ZIP carries every
     * module this file names, and against a wildcard that asserts nothing.
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
     * Every paid tier's words, as the admin bundle receives them.
     *
     * ========================================================================
     * THE ONE PLACE THE ADMIN LEARNS WHAT TO CALL A TIER.
     * ========================================================================
     * Free's admin renders the upsell for a member it does not have, and the
     * word on that card used to be the literal "Pro" in five components. It is
     * read from `tiers.json` instead, so renaming the product is an edit to
     * that file rather than five strings and a release.
     *
     * **The words are not translatable, and that is the trade.** `make-pot`
     * cannot see a JSON string, which is why every other piece of merchant-
     * facing copy in this plugin lives in PHP (ADR 0013). A tier's name is a
     * product name — the thing on the invoice — so it is the one string that
     * should not be translated. The sentence AROUND it stays translatable, with
     * this as its `%s`.
     *
     * **And the services its Destinations connect to** (ADR 0147): brand
     * names, untranslated for the same reason, which free's Destinations hint
     * lists because Pro's types are not registered on a free install.
     *
     * @return array<string, array{name: string, product_name: string, destinations: list<string>}>
     */
    public function forTheAdmin(): array
    {
        $tiers = [];

        foreach (Tier::paid() as $tier) {
            $tiers[$tier->value] = [
                'name' => $this->displayName($tier),
                'product_name' => $this->productName($tier),
                'destinations' => $this->tiers[$tier->value]['destinations'] ?? [],
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
     * The tier whose build ships this module, or null when none does.
     *
     * Read by the admin to name the tier on a module's `locked` card, so the
     * answer comes out of the file the build is checked against rather than a
     * second declaration in PHP.
     */
    public function tierThatShips(string $module): ?Tier
    {
        foreach (Tier::paid() as $tier) {
            if ($this->shipsModule($tier, $module)) {
                return $tier;
            }
        }

        return null;
    }
}
