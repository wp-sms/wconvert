<?php

/**
 * verify-loader-replacement.php — one loader on the page, against real
 * `WP_Dependencies`.
 *
 *     wp eval-file bin/verify-loader-replacement.php
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * WHY THIS EXISTS AND A UNIT TEST DOES NOT DO IT.
 * `tests/unit/Pro/Frontend/LoaderReplacementTest.php` proves the swap against a
 * script queue that RECORDS what it was handed. That is the right shape for
 * asserting which handles are queued — but WordPress's script queue is not a
 * list, it is a dependency graph, and the hazard ADR 0014 names lives in the
 * graph: **`wp_dequeue_script()` alone leaves the handle registered, and
 * WordPress prints the registered dependencies of anything queued.** A stub
 * that re-implemented `all_deps()` would make itself the authority on what
 * WordPress does, and the test would then agree with the stub. So the one
 * claim it cannot make is this one: that after the swap, nothing can put
 * free's loader back on a page that already has Pro's.
 *
 * IT NEEDS BOTH PLUGINS ACTIVE and declines otherwise — the replacement is the
 * thing under test, so a site without Pro has nothing to check. Boot a
 * throwaway WordPress with both mounted; README.md has the one-liner.
 *
 * IT TOUCHES NO MERCHANT DATA. It never reads or writes the published set: it
 * enqueues free's handle by hand, exactly as free's own `enqueue()` does, and
 * then asks Pro's registered service to replace it. What free decides about a
 * given page is `Payload`'s business and is proven elsewhere; what this proves
 * is what the swap leaves behind.
 */

// No `declare(strict_types=1)` — `wp eval-file` evaluates this file's body,
// and a declare that is not the very first statement of a script is a fatal.
use WConvert\Bootstrap;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Pro\Frontend\ProLoaderEnqueue;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-loader-replacement.php\n");

    exit(2);
}

/** @var list<string> $failures */
$failures = [];
$checks = 0;

$check = static function (string $what, bool $passed) use (&$failures, &$checks): void {
    $checks++;

    if (!$passed) {
        $failures[] = $what;
    }

    echo ($passed ? '  ✓ ' : '  ✗ ') . $what . "\n";
};

$decline = static function (string $why): never {
    fwrite(STDERR, $why . "\n");

    exit(2);
};

echo "==> verify-loader-replacement\n";

// --- Is there anything to inspect? ------------------------------------------
//
// Every branch here declines rather than failing. "Could not look" is not
// "clean", and it is not "broken" either — it is a site this script has no
// business reporting on.

if (!defined('WCONVERT_VERSION')) {
    $decline('WConvert is not active — there is no loader to replace.');
}

if (!defined('WCONVERT_PRO_LOADED')) {
    $decline('WConvert Pro is not loaded — the replacement is the thing under test, so there is nothing here to look at. README.md has the two-plugin Playground one-liner.');
}

if (!is_file(WCONVERT_PRO_DIR . 'public/loader/loader.js')) {
    $decline("Pro's loader bundle is missing — run `npm run build:loader:pro`. Without it the replacement declines BY DESIGN, and reporting that as a failure would be this script misreading its own subject.");
}

$freeUrl = WCONVERT_URL . 'public/loader/loader.js';
$proUrl = WCONVERT_PRO_URL . 'public/loader/loader.js';

// --- 1. The swap, against the real queue ------------------------------------

wp_enqueue_script(LoaderEnqueue::HANDLE, $freeUrl, [], '1', true);

Bootstrap::container()->resolve(ProLoaderEnqueue::class)->replace();

$check('exactly one loader is queued, and it is Pro\'s', array_values(array_filter(
    wp_scripts()->queue,
    static fn (string $handle): bool => str_contains($handle, 'loader')
)) === [ProLoaderEnqueue::HANDLE]);

// The half the recording stub cannot tell apart from a dequeue.
$check('free\'s handle is deregistered, not merely dequeued', !wp_script_is(LoaderEnqueue::HANDLE, 'registered'));

// --- 2. The hazard: a third-party script depending on free's handle ----------
//
// This is the whole reason the deregistration is there. With the handle
// dequeued but still registered, WordPress resolves it as a dependency and
// prints it — putting free's loader back on a page that already carries Pro's,
// which is the state ADR 0014 says can never occur.

wp_enqueue_script('some-theme-script', 'https://example.test/theme.js', [LoaderEnqueue::HANDLE], '1', true);

ob_start();
wp_scripts()->do_items();
$printed = (string) ob_get_clean();

$check('free\'s loader is absent from the printed markup', !str_contains($printed, $freeUrl));
$check('Pro\'s loader is printed exactly once', substr_count($printed, $proUrl) === 1);

/*
 * AND THE COST, ASSERTED RATHER THAN ASSUMED. A dependent whose dependency is
 * deregistered is not printed either — `WP_Dependencies::all_deps()` returns
 * false for it. That is a real consequence and it is the accepted one: free's
 * loader handle is not a documented extension point (ADR 0014 refuses to
 * create one), nothing in either plugin depends on it, and the alternative is
 * two loaders on the page, which is the failure the whole design exists to
 * make impossible. It is asserted here so that it is a decision on record
 * rather than a surprise someone meets in a support ticket.
 */
$check('a third-party dependent is dropped with it — the accepted cost, on record', !str_contains($printed, 'theme.js'));

// --- Verdict -----------------------------------------------------------------

echo "\n";

if ($failures !== []) {
    echo sprintf("%d of %d check(s) failed.\n", count($failures), $checks);

    exit(1);
}

echo sprintf("All %d checks passed — one loader on the page, and nothing can put a second one back.\n", $checks);

exit(0);
