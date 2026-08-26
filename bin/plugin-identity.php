<?php

/**
 * plugin-identity.php — which of the two plugins is this tree?
 *
 *     php bin/plugin-identity.php <tree>
 *
 * Prints `key=value` lines for the shell to `eval`, or exits non-zero with a
 * message on stderr.
 *
 * ============================================================================
 * IT IDENTIFIES ITS SUBJECT RATHER THAN BEING TOLD WHICH ONE IT IS.
 * ============================================================================
 * This is the whole reason the file exists. ADR 0029: "the gate is three
 * programs and none takes a flag ... the moment a check has an opt-out, the
 * opt-out is what runs on the day it matters." `verify-artifact-contract.sh`
 * still has to apply free's contract to free's tree and Pro's to Pro's, and a
 * `--free` flag would be exactly the opt-out that ADR forbids — pass `--free`
 * to a Pro tree and the leak check runs against the wrong tier and passes.
 *
 * So the tree answers the question itself: a WordPress plugin directory holds
 * exactly one plugin main file at its root, and which one it is says which
 * plugin this is. ZERO or BOTH is a failure, not a default — a tree holding
 * both is a free ZIP with Pro inside it, which is the leak, and a tree holding
 * neither is not a plugin at all.
 *
 * Four programs read this: bin/verify-artifact-contract.sh (which contract to
 * apply), bin/check-release-tag.php (which tag prefix and which version
 * constant), bin/check-min-core.php and bin/build.sh (the ZIP name and its
 * top-level directory). The first and last shell out to it and `eval` the
 * output; the PHP ones `require` it and call wconvertIdentify() directly, which
 * is why everything below the function is fenced behind "am I the entry
 * script?" rather than running on include. The
 * mapping between a plugin's slug, its tag prefix and its version constant
 * lives HERE and nowhere else, because three copies of it is three chances for
 * `pro-v1.2` to build a ZIP called `wconvert`.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

/**
 * The two plugins this monorepo ships, keyed by the main file that identifies
 * each (ADR 0014 — Pro is a SEPARATE plugin installed alongside free, not a
 * build of the same one).
 *
 * `tag_prefix` is ADR 0030's independent tags: `free-v*` and `pro-v*` carry
 * independent version numbers, each driving its own release run.
 *
 * `version_constant` is the number a running WordPress reads. It is checked
 * against the header AND the tag, because the constant is what Pro's boot
 * guard actually compares — a header the tag agrees with and a constant that
 * disagrees with both ships a plugin that lies to the guard.
 */
const WCONVERT_PLUGINS = [
    'wconvert.php' => [
        'tier' => 'free',
        'slug' => 'wconvert',
        'tag_prefix' => 'free-v',
        'version_constant' => 'WCONVERT_VERSION',
        'constants_file' => 'src/constants.php',
        // Free is the wp.org artifact, so it alone carries a readme.txt whose
        // `Stable tag:` is a third statement of the same version — and the one
        // that decides what every existing install downloads.
        'readme' => 'readme.txt',
    ],
    'wconvert-pro.php' => [
        'tier' => 'pro',
        'slug' => 'wconvert-pro',
        'tag_prefix' => 'pro-v',
        'version_constant' => 'WCONVERT_PRO_VERSION',
        'constants_file' => 'src/constants.php',
        'readme' => null,
    ],
];

/**
 * Directory names that are a Pro tree wherever they appear.
 *
 * `pro/` is where Pro lives in this repo; `wconvert-pro/` is where it lives in
 * an installed WordPress. A free artifact must contain neither, at any depth
 * (ADR 0029, check c).
 */
const WCONVERT_PRO_DIR_NAMES = ['pro', 'wconvert-pro'];

/**
 * Which plugin a tree is, or a message saying why that cannot be answered.
 *
 * The VERSION is deliberately not part of this. Identity and version are two
 * questions, and answering them together made
 * bin/verify-artifact-contract.sh report "cannot identify the staged tree" for
 * a tree it had identified perfectly well — then skip every check below it,
 * because a tree it cannot identify is a tree it cannot check. A missing
 * version header is a release-guard failure, not an identity one.
 * wconvertHeaderVersion() answers that question separately.
 *
 * @return array{tier: string, slug: string, main_file: string, tag_prefix: string,
 *               version_constant: string, constants_file: string, readme: string,
 *               other_main_file: string, pro_dir_names: string}
 * @throws RuntimeException when the tree is unreadable, holds no plugin main
 *         file, or holds more than one.
 */
function wconvertIdentify(string $tree): array
{
    $resolved = realpath($tree);

    if ($resolved === false || !is_dir($resolved) || !is_readable($resolved)) {
        throw new RuntimeException("not a readable directory: {$tree}");
    }

    $found = [];

    foreach (array_keys(WCONVERT_PLUGINS) as $mainFile) {
        if (is_file($resolved . '/' . $mainFile)) {
            $found[] = $mainFile;
        }
    }

    if ($found === []) {
        throw new RuntimeException(
            "no plugin main file at the root of {$tree} — expected one of "
            . implode(', ', array_keys(WCONVERT_PLUGINS))
        );
    }

    if (count($found) > 1) {
        // Not an ambiguity to resolve. A tree holding both main files is one
        // plugin's artifact with the other plugin inside it, which is the leak
        // the artifact contract exists to catch.
        throw new RuntimeException(
            "{$tree} holds more than one plugin main file (" . implode(', ', $found)
            . ") — one artifact is not two plugins"
        );
    }

    $mainFile = $found[0];
    $plugin = WCONVERT_PLUGINS[$mainFile];
    $other = array_values(array_diff(array_keys(WCONVERT_PLUGINS), [$mainFile]))[0];

    return [
        'tier' => $plugin['tier'],
        'slug' => $plugin['slug'],
        'main_file' => $mainFile,
        'tag_prefix' => $plugin['tag_prefix'],
        'version_constant' => $plugin['version_constant'],
        'constants_file' => $plugin['constants_file'],
        'readme' => $plugin['readme'] ?? '',
        'other_main_file' => $other,
        // A space-separated list for the shell: every directory name that IS a
        // Pro tree, wherever it turns up. Emitted from here so
        // verify-artifact-contract.sh does not carry a second copy of it.
        'pro_dir_names' => implode(' ', WCONVERT_PRO_DIR_NAMES),
    ];
}

/**
 * The `Version:` header of a plugin main file.
 *
 * ONE reader of that header exists and this is it, so bin/build.sh and
 * bin/check-release-tag.php cannot disagree about what version a tree is —
 * WSMS says the same thing out loud in its own guard ("read exactly the way
 * bin/build.sh reads it, so the check and the build can never disagree") and
 * enforces it by having copied the sed twice.
 *
 * Anchored to the start of a line so a `Version:` inside prose cannot
 * masquerade as the header, and stopped at the first character a version may
 * not contain.
 *
 * MORE THAN ONE IS A FAILURE, not a "take the first". A file with two version
 * headers has whichever version its reader reaches first, and WordPress and
 * this program are two different readers.
 *
 * @throws RuntimeException when there is not exactly one.
 */
function wconvertHeaderVersion(string $path, string $label): string
{
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException("{$label} is missing or unreadable — this tree does not say what version it is");
    }

    $contents = file_get_contents($path);

    if ($contents === false || $contents === '') {
        throw new RuntimeException("{$label} is empty — this tree does not say what version it is");
    }

    $count = preg_match_all('/^[ \t*]*Version:[ \t]*([0-9A-Za-z.+-]+)/m', $contents, $matches);

    if ($count === false || $count === 0) {
        throw new RuntimeException("no Version: header in {$label} — this tree does not say what version it is");
    }

    if ($count > 1) {
        throw new RuntimeException("{$label} has {$count} Version: headers — which one ships is whichever reader gets there first");
    }

    return $matches[1][0];
}

/*
|--------------------------------------------------------------------------
| The command-line half
|--------------------------------------------------------------------------
| Only when this file IS the script being run. `require`d by the two PHP
| programs above, it defines the table and the function and does nothing else.
*/

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "plugin-identity.php runs on the command line only.\n");
    exit(2);
}

$tree = $argv[1] ?? '';

if ($tree === '') {
    fwrite(STDERR, "usage: php bin/plugin-identity.php <tree>\n");
    exit(2);
}

try {
    $fields = wconvertIdentify($tree);
} catch (RuntimeException $failure) {
    fwrite(STDERR, $failure->getMessage() . "\n");
    exit(1);
}

foreach ($fields as $key => $value) {
    printf("%s=%s\n", $key, escapeshellarg((string) $value));
}
