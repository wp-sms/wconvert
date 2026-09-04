<?php

/**
 * tier-manifest.php — the tier ladder, for the programs written in shell.
 *
 *     php bin/tier-manifest.php tiers       <tiers.json>
 *     php bin/tier-manifest.php modules     <tiers.json> <tier>
 *     php bin/tier-manifest.php infer       <tiers.json> <pro-tree>
 *     php bin/tier-manifest.php identifiers <tiers.json> <tier> <rules manifest>
 *     php bin/tier-manifest.php markers     <tiers.json> <tier> <pro modules dir>
 *     php bin/tier-manifest.php unmarked    <tiers.json> <tier> <pro modules dir>
 *
 * Prints one value per line on stdout, or exits non-zero with a message on
 * stderr. Exit 0 = answered, 1 = could not answer.
 *
 * =============================================================================
 * IT LOADS NOTHING, WHICH IS THE SAME REASON bin/plugin-identity.php DOES NOT.
 * =============================================================================
 * `WConvert\Support\TierManifest` is the reader every RUNNING install uses, and
 * this is deliberately not it. Both callers here — bin/build.sh and
 * bin/verify-artifact-contract.sh — run against a STAGED tree, at a moment when
 * free's `vendor/autoload.php` may not exist and `ABSPATH` certainly does not.
 * A release gate that needed the plugin booted to answer "which modules does
 * Basic ship" would be a gate that stops running the day the build breaks,
 * which is the day it matters (ADR 0029).
 *
 * So this reads the JSON directly, and the ORDER it reports is the file's own
 * declaration order. `WConvert\Support\Tier::paid()` spells the same ladder in
 * code — deliberately, so a ladder cannot fail open when its file is missing —
 * and `tests/unit/Support/TierManifestTest.php` asserts the two agree. That
 * assertion is what makes this file's simpler reading safe.
 *
 * =============================================================================
 * `infer` IS THE SAME INFERENCE `WpProPresence` MAKES, ASKED OF A ZIP.
 * =============================================================================
 * A build's tier is not stored anywhere: it is read back off the module
 * directories the build left behind, mapped through this file to the lowest
 * tier that ships each, taking the highest (ADR 0056). A running install does
 * that to decide what to offer; the artifact contract does it to decide WHICH
 * CONTRACT to apply — so that no `--basic` flag exists to be passed to the
 * wrong tree, which is ADR 0029's rule about the gate having no opt-outs.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

/**
 * The premium rungs, ascending, as the file declares them.
 *
 * @return list<array{slug: string, modules: list<string>}>
 * @throws RuntimeException
 */
function wconvertTiers(string $path): array
{
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException("tier manifest is missing or unreadable: {$path}");
    }

    $decoded = json_decode((string) file_get_contents($path), true);

    if (!is_array($decoded)) {
        throw new RuntimeException("tier manifest is not JSON: {$path}");
    }

    $declared = $decoded['premium']['tiers'] ?? null;

    if (!is_array($declared) || $declared === []) {
        throw new RuntimeException("tier manifest declares no premium tiers: {$path}");
    }

    $tiers = [];

    foreach ($declared as $entry) {
        if (!is_array($entry) || !is_string($entry['slug'] ?? null) || $entry['slug'] === '') {
            throw new RuntimeException("tier manifest declares a tier with no slug: {$path}");
        }

        $modules = $entry['modules'] ?? [];
        $modules = array_values(array_filter(is_array($modules) ? $modules : [], 'is_string'));

        if ($modules === []) {
            throw new RuntimeException("tier \"{$entry['slug']}\" names no module — every rung names its own, there is no wildcard: {$path}");
        }

        $tiers[] = ['slug' => $entry['slug'], 'modules' => $modules];
    }

    return $tiers;
}

/**
 * Whether a rung's build ships a module.
 *
 * Every rung names its own, including the top — see `tiers.json`'s note on why
 * there is no wildcard: against `"*"` the artifact contract's completeness
 * half asserts nothing, which would leave the rung every customer buys as the
 * one rung with no check.
 *
 * @param array{slug: string, modules: list<string>} $tier
 */
function wconvertTierShips(array $tier, string $module): bool
{
    return in_array($module, $tier['modules'], true);
}

/**
 * The module slugs a Pro tree actually carries, read out of their own
 * `module.json` files.
 *
 * Off the FILE rather than off the directory name, so a directory renamed by an
 * unpacker cannot quietly become a different module.
 *
 * @return list<string>
 * @throws RuntimeException when the tree carries no module at all — a Pro build
 *         with nothing in it is not a tier, it is a broken ZIP.
 */
function wconvertInstalledModules(string $tree): array
{
    $manifests = glob(rtrim($tree, '/') . '/modules/*/module.json');
    $slugs = [];

    foreach ($manifests === false ? [] : $manifests as $file) {
        $decoded = json_decode((string) @file_get_contents($file), true);
        $slug = is_array($decoded) ? ($decoded['slug'] ?? null) : null;

        if (!is_string($slug) || $slug === '') {
            throw new RuntimeException("module manifest names no slug: {$file}");
        }

        $slugs[] = $slug;
    }

    if ($slugs === []) {
        throw new RuntimeException("no module under {$tree}/modules/ — this tree is at no tier");
    }

    sort($slugs);

    return $slugs;
}

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "tier-manifest.php runs on the command line only.\n");
    exit(2);
}

$command = $argv[1] ?? '';
$path = $argv[2] ?? '';

try {
    if ($path === '') {
        throw new RuntimeException('usage: php bin/tier-manifest.php <tiers|modules|infer|identifiers|markers|unmarked> <tiers.json> [tier|tree] [rules.json|modules dir]');
    }

    $tiers = wconvertTiers($path);

    switch ($command) {
        case 'tiers':
            foreach ($tiers as $tier) {
                echo $tier['slug'], "\n";
            }

            break;

        case 'modules':
            $wanted = $argv[3] ?? '';

            foreach ($tiers as $tier) {
                if ($tier['slug'] !== $wanted) {
                    continue;
                }

                foreach ($tier['modules'] as $module) {
                    echo $module, "\n";
                }

                exit(0);
            }

            throw new RuntimeException("no tier called \"{$wanted}\" in {$path}");

        case 'infer':
            $tree = $argv[3] ?? '';

            if ($tree === '') {
                throw new RuntimeException('infer needs a tree to look at');
            }

            $highest = null;

            foreach (wconvertInstalledModules($tree) as $module) {
                // The LOWEST rung that ships it — the first match walking up.
                foreach ($tiers as $index => $tier) {
                    if (wconvertTierShips($tier, $module)) {
                        $highest = $highest === null ? $index : max($highest, $index);

                        break;
                    }
                }
            }

            if ($highest === null) {
                throw new RuntimeException("no module in {$tree} belongs to any tier {$path} declares");
            }

            echo $tiers[$highest]['slug'], "\n";

            break;

        case 'identifiers':
            /*
             * ============================================================
             * EVERY RULE TYPE FILED ABOVE A RUNG — THE JAVASCRIPT HALF OF
             * THE PER-TIER CONTRACT.
             * ============================================================
             * `bin/verify-artifact-contract.sh` greps a staged tier's built
             * bundles for these. A Basic ZIP carrying `exit_intent` in its
             * `loader.js` is the WSMS failure exactly: all three of its
             * premium tiers ship a byte-identical `main.js`, so a Basic
             * customer holds the Elite UI behind a client-readable flag, and
             * under possession-gating that is not a weaker gate but no gate
             * (ADR 0056).
             *
             * `bin/check-loader.mjs` asserts the same thing on every pull
             * request against the REPOSITORY's builds; this asserts it on the
             * ZIP, which is the artifact somebody can actually upload.
             *
             * An entry filed at a rung the ladder does not declare is a
             * failure rather than an identifier quietly belonging to no scan.
             */
            $wanted = $argv[3] ?? '';
            $rules = $argv[4] ?? '';

            if ($rules === '' || !is_file($rules) || !is_readable($rules)) {
                throw new RuntimeException("rule manifest is missing or unreadable: {$rules}");
            }

            $slugs = array_column($tiers, 'slug');
            $rank = array_search($wanted, $slugs, true);

            if ($rank === false) {
                throw new RuntimeException("no tier called \"{$wanted}\" in {$path}");
            }

            $manifest = json_decode((string) file_get_contents($rules), true);

            if (!is_array($manifest) || $manifest === []) {
                throw new RuntimeException("rule manifest declares no axes: {$rules}");
            }

            foreach ($manifest as $entries) {
                if (!is_array($entries)) {
                    continue;
                }

                foreach ($entries as $type => $entry) {
                    $at = is_array($entry) ? ($entry['tier'] ?? 'free') : 'free';

                    if ($at === 'free') {
                        continue;
                    }

                    $atRank = array_search($at, $slugs, true);

                    if ($atRank === false) {
                        throw new RuntimeException("{$rules}: {$type} is filed at \"{$at}\", which {$path} does not declare");
                    }

                    if ($atRank > $rank) {
                        echo $type, "\n";
                    }
                }
            }

            break;

        case 'markers':
        case 'unmarked':
            /*
             * ============================================================
             * THE SAME SCAN FOR A MODULE THAT SHIPS NO RULE TYPE AT ALL.
             * ============================================================
             * `identifiers` above reads its list out of the RULE MANIFEST, so
             * it can only see a module whose contribution is a rule. The first
             * module whose contribution is not — `ab-testing`, which ships a
             * payload narrowing and two REST routes — would therefore have had
             * a Basic bundle carrying its whole arm-drawing routine pass every
             * check there is. That is the byte-identical failure ADR 0056
             * measures WSMS by, reached through a gap in the scan rather than
             * through a flag.
             *
             * So a module may DECLARE a token that appears in its own built
             * JavaScript, in its own `module.json`, beside the slug that
             * already names it — no new list, and nothing to keep in step
             * (ADR 0015). A module that declares none is not scanned for, and
             * both callers say so out loud rather than printing a tick.
             *
             * Read from the REPOSITORY's `pro/modules/`, never from the staged
             * tree: the whole question is about a module the cut removed, so
             * its manifest is exactly what is no longer there to read.
             */
            $wanted = $argv[3] ?? '';
            $modulesDir = $argv[4] ?? '';

            if ($modulesDir === '' || !is_dir($modulesDir)) {
                throw new RuntimeException("module directory is missing or unreadable: {$modulesDir}");
            }

            $slugs = array_column($tiers, 'slug');
            $rank = array_search($wanted, $slugs, true);

            if ($rank === false) {
                throw new RuntimeException("no tier called \"{$wanted}\" in {$path}");
            }

            $manifests = glob(rtrim($modulesDir, '/') . '/*/module.json');

            if ($manifests === false || $manifests === []) {
                throw new RuntimeException("no module manifest under {$modulesDir}");
            }

            foreach ($manifests as $file) {
                $decoded = json_decode((string) @file_get_contents($file), true);
                $slug = is_array($decoded) ? ($decoded['slug'] ?? null) : null;
                $marker = is_array($decoded) ? ($decoded['bundle_marker'] ?? null) : null;

                if (!is_string($slug) || $slug === '') {
                    throw new RuntimeException("module manifest names no slug: {$file}");
                }

                $declares = is_string($marker) && $marker !== '';

                // `unmarked` is the same walk asking the opposite question, so
                // it is one case rather than two: a module above this rung that
                // declares NO marker is one nothing looked for, and the caller
                // has to be able to say so beside its tick (ADR 0029).
                if ($declares === ($command === 'unmarked')) {
                    continue;
                }

                // The LOWEST rung that ships it, exactly as `infer` reads the
                // ladder — a module is evidence of at least that rung.
                $atRank = false;

                foreach ($tiers as $index => $tier) {
                    if (wconvertTierShips($tier, $slug)) {
                        $atRank = $index;

                        break;
                    }
                }

                if ($atRank === false) {
                    throw new RuntimeException("{$file}: the {$slug} module is shipped by no tier {$path} declares");
                }

                if ($atRank > $rank) {
                    echo $declares ? $marker : $slug, "\n";
                }
            }

            break;

        default:
            throw new RuntimeException('usage: php bin/tier-manifest.php <tiers|modules|infer|identifiers|markers|unmarked> <tiers.json> [tier|tree] [rules.json|modules dir]');
    }
} catch (RuntimeException $failure) {
    fwrite(STDERR, $failure->getMessage() . "\n");
    exit(1);
}

exit(0);
