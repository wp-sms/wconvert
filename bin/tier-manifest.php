<?php

/**
 * tier-manifest.php — `tiers.json`, for the programs written in shell.
 *
 *     php bin/tier-manifest.php tiers   <tiers.json>
 *     php bin/tier-manifest.php modules <tiers.json> <tier>
 *
 * Prints one value per line on stdout, or exits non-zero with a message on
 * stderr. Exit 0 = answered, 1 = could not answer.
 *
 * =============================================================================
 * IT LOADS NOTHING, WHICH IS THE SAME REASON bin/plugin-identity.php DOES NOT.
 * =============================================================================
 * `WConvert\Support\TierManifest` is the reader every RUNNING install uses, and
 * this is deliberately not it. Its caller — bin/verify-artifact-contract.sh —
 * runs against a STAGED tree, at a moment when free's `vendor/autoload.php` may
 * not exist and `ABSPATH` certainly does not. A release gate that needed the
 * plugin booted to answer "which modules does Pro ship" would be a gate that
 * stops running the day the build breaks, which is the day it matters
 * (ADR 0029).
 *
 * So this reads the JSON directly. `WConvert\Support\Tier::paid()` spells the
 * same tiers in code, and `tests/unit/Support/TierManifestTest.php` asserts the
 * two agree.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

/**
 * The paid tiers, as the file declares them.
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
            throw new RuntimeException("tier \"{$entry['slug']}\" names no module — Pro names its own, there is no wildcard: {$path}");
        }

        $tiers[] = ['slug' => $entry['slug'], 'modules' => $modules];
    }

    return $tiers;
}

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "tier-manifest.php runs on the command line only.\n");
    exit(2);
}

$command = $argv[1] ?? '';
$path = $argv[2] ?? '';

try {
    if ($path === '') {
        throw new RuntimeException('usage: php bin/tier-manifest.php <tiers|modules> <tiers.json> [tier]');
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

        default:
            throw new RuntimeException('usage: php bin/tier-manifest.php <tiers|modules> <tiers.json> [tier]');
    }
} catch (RuntimeException $failure) {
    fwrite(STDERR, $failure->getMessage() . "\n");
    exit(1);
}

exit(0);
