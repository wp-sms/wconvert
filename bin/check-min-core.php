<?php

/**
 * check-min-core.php — release guard condition 5, the Pro-only one.
 *
 *     php bin/check-min-core.php <pro-tree> <published-free-version>
 *
 * Exit 0 = Pro may ship. Exit 1 = it may not, OR the check could not look.
 *
 * ============================================================================
 * THE ANCHOR IS THE PUBLISHED VERSION, AND THAT IS THE WHOLE CHECK.
 * ============================================================================
 * ADR 0030: "Pro's WCONVERT_MIN_CORE must be ≤ the highest free version
 * actually published." Not the one in the working tree — a check anchored to
 * the repo passes the exact release it exists to catch, because the repo is
 * where the un-published version already lives.
 *
 * The failure is Pro 1.3 requiring core 1.3 while free 1.3 is still in the
 * wp.org queue: a Pro that refuses to boot on every install that can exist,
 * presenting to the merchant as premium features silently missing with no
 * error they can act on. So the published version is passed IN, from
 * bin/published-free-version.sh, and this program never reads a version out of
 * the tree it is checking. That split is deliberate twice over — it is what
 * makes the condition testable against a stubbed number, and it is the same
 * split WConvert\Pro\Boot\MinCoreCheck already draws between the comparison
 * and the WordPress that supplies its inputs.
 *
 * ============================================================================
 * AND IT ASKS THE RUNTIME GUARD'S OWN QUESTION, WITH ITS OWN CODE.
 * ============================================================================
 * `MinCoreCheck::evaluate($installedCore, $minCore)` is Satisfied when the
 * installed free version is ≥ WCONVERT_MIN_CORE. Put the PUBLISHED version
 * where the installed one goes and it answers exactly this condition: would
 * the best-case install — one running the newest free anybody can get — boot
 * this Pro? A verdict of CoreTooOld here is a verdict of CoreTooOld on every
 * install in the world.
 *
 * Reusing the class rather than re-implementing the comparison is what keeps
 * that equivalence true. A release guard that ranked versions its own way
 * could pass a release the runtime then refuses, which is the single failure
 * mode this condition exists for. It also inherits the class's own
 * fail-closed argument for free: version_compare() never reports that it could
 * not read its input — PHP evaluates version_compare('99 bottles', '1.4.0',
 * '>=') as TRUE — so an unreadable version on either side is a refusal here
 * too, never a comparison.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

require_once __DIR__ . '/plugin-identity.php';

const MIN_CORE_CLEAN = 0;
const MIN_CORE_FAILED = 1;

$tree = $argv[1] ?? '';
$published = $argv[2] ?? '';

if ($tree === '' || $published === '') {
    fwrite(STDERR, "usage: php bin/check-min-core.php <pro-tree> <published-free-version>\n");
    exit(MIN_CORE_FAILED);
}

$tree = rtrim($tree, '/');

fwrite(STDERR, "==> check-min-core: {$tree} against published free {$published}\n");

/**
 * Say why, and stop. Every exit from this program below is this one, because
 * every one of them is the same verdict: the condition was not satisfied, and
 * "could not look" is one of the ways it is not satisfied.
 *
 * `never` rather than `void`, and not for decoration: it is what tells a reader
 * — and the analyser — that the lines after each call are unreachable, so the
 * value that was just found unreadable is not read anyway.
 */
function minCoreFail(string $message): never
{
    fwrite(STDERR, "  ✗ {$message}\n");
    fwrite(STDERR, "==> check-min-core FAILED.\n");
    exit(MIN_CORE_FAILED);
}

try {
    $identity = wconvertIdentify($tree);
} catch (RuntimeException $failure) {
    minCoreFail("cannot identify the tree — cannot verify: {$failure->getMessage()}");
}

// A free tree has no WCONVERT_MIN_CORE and no business being here. Only the
// Pro run evaluates this condition (ADR 0030), and a program that quietly
// passed when pointed at the wrong tree would report "condition 5 ✓" for a
// condition it never evaluated.
if ($identity['tier'] !== 'pro') {
    minCoreFail("{$tree} is the {$identity['tier']} tree — WCONVERT_MIN_CORE is Pro's statement about free");
}

$constantsPath = $tree . '/' . $identity['constants_file'];

if (!is_file($constantsPath) || !is_readable($constantsPath)) {
    minCoreFail("{$identity['constants_file']} is missing or unreadable — WCONVERT_MIN_CORE was not read");
}

$constants = file_get_contents($constantsPath);

if ($constants === false || $constants === '') {
    minCoreFail("{$identity['constants_file']} is empty — WCONVERT_MIN_CORE was not read");
}

$found = preg_match_all(
    '/\bdefine\(\s*[\'"]WCONVERT_MIN_CORE[\'"]\s*,\s*[\'"]([^\'"]*)[\'"]\s*\)/',
    $constants,
    $matches
);

if ($found === false || $found === 0) {
    minCoreFail("no define() of WCONVERT_MIN_CORE in {$identity['constants_file']} — cannot verify");
}

if ($found > 1) {
    minCoreFail("WCONVERT_MIN_CORE is defined {$found} times in {$identity['constants_file']} — which one ships is whichever reader gets there first");
}

$minCore = $matches[1][0];

/*
 * Pro's own guard, borrowed whole.
 *
 * These two files are ordinary classes behind WordPress's standard
 * direct-access guard, so ABSPATH stands in for the WordPress this program
 * does not have — the same stand-in pro/phpstan-bootstrap.php makes for
 * analysis. Nothing else about WordPress is needed: MinCoreCheck is a pure
 * comparison by design, which is exactly why it can be reused here.
 */
defined('ABSPATH') || define('ABSPATH', __DIR__ . '/');

$proBoot = dirname(__DIR__) . '/pro/src/Boot';

foreach (['MinCoreVerdict.php', 'MinCoreCheck.php'] as $class) {
    $path = $proBoot . '/' . $class;

    if (!is_file($path) || !is_readable($path)) {
        minCoreFail("cannot read pro/src/Boot/{$class} — the comparison this condition shares with the runtime guard is unavailable");
    }

    require_once $path;
}

$verdict = WConvert\Pro\Boot\MinCoreCheck::evaluate($published, $minCore);

if ($verdict !== WConvert\Pro\Boot\MinCoreVerdict::Satisfied) {
    fwrite(STDERR, "  ✗ WCONVERT_MIN_CORE is {$minCore}; the highest free version published is {$published}.\n");
    fwrite(STDERR, "  ✗ MinCoreCheck says {$verdict->name} — this Pro would refuse to boot on every install that can exist.\n");
    fwrite(STDERR, "    Lower WCONVERT_MIN_CORE, or publish that free version first.\n");
    fwrite(STDERR, "==> check-min-core FAILED.\n");
    exit(MIN_CORE_FAILED);
}

fwrite(STDERR, "  ✓ WCONVERT_MIN_CORE {$minCore} ≤ published free {$published}\n");

exit(MIN_CORE_CLEAN);
