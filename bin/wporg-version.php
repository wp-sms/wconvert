<?php

/**
 * wporg-version.php — the version out of a wp.org plugin information response.
 *
 *     curl … | php bin/wporg-version.php
 *
 * Prints that version on stdout and nothing else. Exit 0 = it was read.
 * Exit 1 = it was not, for any reason at all, with the reason on stderr.
 *
 * ============================================================================
 * A SEPARATE PROGRAM BECAUSE THE HALF THAT CAN BE WRONG IS THE HALF THAT CAN
 * BE TESTED.
 * ============================================================================
 * This lived inside bin/published-free-version.sh as an inline `php -r`, and
 * that made ADR 0030's fifth release-guard condition rest on a parse nothing
 * asserted — including its most important branch, the one where wp.org says
 * it has never heard of the plugin. Splitting the fetch from the parse is the
 * same split WConvert\Pro\Boot\MinCoreCheck already draws between a comparison
 * and the WordPress that supplies its inputs, and it is drawn here for the
 * same reason: what reads from the network cannot be asserted cheaply, and
 * what decides can.
 *
 * The fetch stays in the shell, where curl belongs. Everything below is a pure
 * function of the bytes wp.org returned, and
 * tests/unit/Contract/ReleaseGuardTest.php feeds it those bytes directly.
 *
 * ============================================================================
 * EVERY BRANCH BUT ONE IS A FAILURE, AND THAT IS THE DESIGN.
 * ============================================================================
 * `{"error":"Plugin not found."}` is not a version of zero. If free has never
 * been published there is no version any install can be running, so no
 * WCONVERT_MIN_CORE can be satisfied and no Pro release may go out — free
 * ships first, always (ADR 0030). A parse that returned "0.0.0" here would
 * turn that into a Pro release that boots nowhere.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

const WPORG_VERSION_READ = 0;
const WPORG_VERSION_UNREADABLE = 1;

$raw = stream_get_contents(STDIN);

if ($raw === false || trim($raw) === '') {
    fwrite(STDERR, "wp.org returned an empty response\n");
    exit(WPORG_VERSION_UNREADABLE);
}

$data = json_decode($raw, true);

if (!is_array($data)) {
    fwrite(STDERR, "wp.org returned something that is not JSON\n");
    exit(WPORG_VERSION_UNREADABLE);
}

// wp.org answers 404 with a JSON body rather than nothing, and the shell that
// called this reports the status separately — but a body saying `error` is
// still an error whatever the status was, so it is caught here too.
if (isset($data['error'])) {
    fwrite(STDERR, 'wp.org: ' . (is_string($data['error']) ? $data['error'] : 'unknown error') . "\n");
    exit(WPORG_VERSION_UNREADABLE);
}

$version = $data['version'] ?? null;

if (!is_string($version) || trim($version) === '') {
    fwrite(STDERR, "wp.org returned no version for this plugin\n");
    exit(WPORG_VERSION_UNREADABLE);
}

/*
 * Shaped like a version, or nothing.
 *
 * The same shape WConvert\Pro\Boot\MinCoreCheck calls readable, and the reason
 * is its reason: version_compare() never reports that it could not read its
 * input — PHP ranks version_compare('99 bottles', '1.4.0', '>=') as TRUE — so
 * anything that is not a version has to be refused before it reaches a
 * comparison rather than after.
 */
if (preg_match('/^\d+(\.\d+)*([-+][0-9A-Za-z.\-+]+)?$/', trim($version)) !== 1) {
    fwrite(STDERR, "wp.org returned '{$version}', which is not shaped like a version\n");
    exit(WPORG_VERSION_UNREADABLE);
}

echo trim($version);

exit(WPORG_VERSION_READ);
