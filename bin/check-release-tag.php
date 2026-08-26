<?php

/**
 * check-release-tag.php — release guard conditions 2 and 4.
 *
 *     php bin/check-release-tag.php <tag> <plugin-tree>
 *
 * Prints the version on stdout when every statement of it agrees. Exit 0 =
 * agreement, 1 = a disagreement OR the check could not look.
 *
 * ============================================================================
 * CONDITION 2 — THE TAG LOOKS LIKE A VERSION, FOR *THIS* PLUGIN.
 * ============================================================================
 * `free-v*` and `pro-v*` are separate tags with independent version numbers,
 * each driving its own release run out of the one monorepo (ADR 0030). So the
 * shape check is not "does this look like a tag" but "does this look like a
 * tag for the plugin I am pointed at" — which is what stops `pro-v1.4` from
 * driving a free release, the failure a shared `v*` pattern would make
 * invisible. The prefix comes from the tree, never from an argument.
 *
 * ============================================================================
 * CONDITION 4 — EVERY STATEMENT OF THE VERSION AGREES.
 * ============================================================================
 * WSMS asserts the tag against ONE thing, `wp-sms.php`'s `Version:` header,
 * and that is enough for WSMS because a WSMS install has one number. Here
 * there are three statements of a free release's version and two of a Pro
 * one, and each is read by something different:
 *
 *   - the `Version:` header      — what WordPress shows on the Plugins screen
 *   - the version CONSTANT       — WCONVERT_VERSION / WCONVERT_PRO_VERSION,
 *                                  which is what runs. Pro's boot guard
 *                                  compares WCONVERT_MIN_CORE against free's
 *                                  CONSTANT, not against its header, so a
 *                                  constant that disagrees with the header is
 *                                  a plugin that lies to the one check ADR
 *                                  0030 rests the whole free/Pro skew on.
 *   - `Stable tag:` in readme.txt — free only, and the most dangerous of the
 *                                  three: it is what wp.org actually serves.
 *                                  A correct ZIP under a stale stable tag
 *                                  ships the OLD version to every existing
 *                                  install and looks like a successful
 *                                  release from every angle but the user's.
 *
 * Checking one and shipping three is checking the one nobody installs.
 *
 * IT FAILS CLOSED. An unreadable file, an absent header, a constant defined
 * twice — each is "could not look", and could-not-look is never a pass
 * (ADR 0029).
 *
 * @since 0.1.0
 */

declare(strict_types=1);

require_once __DIR__ . '/plugin-identity.php';

const TAG_CHECK_CLEAN = 0;
const TAG_CHECK_FAILED = 1;

/** @var list<string> $problems */
$problems = [];

$fail = static function (string $message) use (&$problems): void {
    $problems[] = $message;
};

$tag = $argv[1] ?? '';
$tree = $argv[2] ?? '';

if ($tag === '' || $tree === '') {
    fwrite(STDERR, "usage: php bin/check-release-tag.php <tag> <plugin-tree>\n");
    exit(TAG_CHECK_FAILED);
}

$tree = rtrim($tree, '/');

fwrite(STDERR, "==> check-release-tag: {$tag} against {$tree}\n");

try {
    $identity = wconvertIdentify($tree);
} catch (RuntimeException $failure) {
    fwrite(STDERR, "  ✗ cannot identify the tree — cannot verify: {$failure->getMessage()}\n");
    exit(TAG_CHECK_FAILED);
}

/**
 * The one statement of "a number shaped like a version" this program makes.
 *
 * Deliberately the same shape WSMS's condition 2 accepts — X.Y or X.Y.Z with
 * an optional pre-release suffix, so `free-v0.1.0` and `pro-v1.0-beta.5` both
 * pass and `free-vlatest` does not.
 */
const VERSION_SHAPE = '[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[0-9A-Za-z][0-9A-Za-z.]*)?';

// --- Condition 2 -------------------------------------------------------------

$prefix = $identity['tag_prefix'];
$pattern = '/^' . preg_quote($prefix, '/') . '(' . VERSION_SHAPE . ')$/';

if (preg_match($pattern, $tag, $match) !== 1) {
    fwrite(
        STDERR,
        "  ✗ tag '{$tag}' is not a release tag for {$identity['slug']}. "
        . "Expected {$prefix}X.Y or {$prefix}X.Y.Z, with an optional suffix such as {$prefix}1.0-beta.5.\n"
    );
    exit(TAG_CHECK_FAILED);
}

$version = $match[1];

fwrite(STDERR, "  ✓ tag names {$identity['slug']} and is shaped like a version: {$version}\n");

// --- Condition 4 -------------------------------------------------------------

/**
 * Read a file, or record why it could not be read.
 */
$read = static function (string $relative) use ($tree, $fail): ?string {
    $path = $tree . '/' . $relative;

    if (!is_file($path) || !is_readable($path)) {
        $fail("{$relative} is missing or unreadable — the version it states was not checked");

        return null;
    }

    $contents = file_get_contents($path);

    if ($contents === false || $contents === '') {
        $fail("{$relative} is empty — the version it states was not checked");

        return null;
    }

    return $contents;
};

/**
 * The single value a pattern captures, or null having recorded why not.
 *
 * MORE THAN ONE MATCH IS A FAILURE, not a "take the first". Two `define()`s of
 * the same constant, or two `Version:` lines, is a file whose version is
 * whichever one the reader happened to reach first — and this program and
 * WordPress are two different readers.
 */
$soleMatch = static function (string $pattern, string $haystack, string $what) use ($fail): ?string {
    $count = preg_match_all($pattern, $haystack, $matches);

    if ($count === false) {
        $fail("could not scan for {$what} — cannot verify");

        return null;
    }

    if ($count === 0) {
        $fail("no {$what} found — cannot verify");

        return null;
    }

    if ($count > 1) {
        $fail("{$what} appears {$count} times — which one ships is whichever reader gets there first");

        return null;
    }

    return $matches[1][0];
};

/** @var array<string, string|null> $statements Where the version is stated => what it says. */
$statements = [];

// Read by the one reader of that header, shared with bin/build.sh, so the
// guard and the build can never disagree about what version a tree is.
try {
    $statements[$identity['main_file'] . ' (Version: header)'] =
        wconvertHeaderVersion($tree . '/' . $identity['main_file'], $identity['main_file']);
} catch (RuntimeException $failure) {
    $fail($failure->getMessage());
}

$constantsFile = $read($identity['constants_file']);

if ($constantsFile !== null) {
    $constant = $identity['version_constant'];
    $statements[$identity['constants_file'] . " ({$constant})"] = $soleMatch(
        '/\bdefine\(\s*[\'"]' . preg_quote($constant, '/') . '[\'"]\s*,\s*[\'"]([^\'"]*)[\'"]\s*\)/',
        $constantsFile,
        "a define() of {$constant}"
    );
}

// Free only, because free alone is the wp.org artifact. Pro has no readme.txt
// and asserting one would fail every Pro release for a file it must not have.
if ($identity['readme'] !== '') {
    $readme = $read($identity['readme']);

    if ($readme !== null) {
        $statements[$identity['readme'] . ' (Stable tag:)'] =
            $soleMatch('/^Stable tag:[ \t]*([0-9A-Za-z.+-]+)/m', $readme, 'a Stable tag: line');
    }
}

foreach ($statements as $where => $stated) {
    if ($stated === null) {
        continue;
    }

    if ($stated === $version) {
        fwrite(STDERR, "  ✓ {$where} says {$stated}\n");

        continue;
    }

    $fail("{$where} says '{$stated}' but the tag says '{$version}' — bump it, or re-tag");
}

if ($problems !== []) {
    fwrite(STDERR, "\n==> check-release-tag FAILED:\n");

    foreach ($problems as $problem) {
        fwrite(STDERR, "  ✗ {$problem}\n");
    }

    exit(TAG_CHECK_FAILED);
}

// stdout carries the answer and nothing else, so the caller can capture it.
echo $version, "\n";

exit(TAG_CHECK_CLEAN);
