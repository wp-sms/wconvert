<?php

/** Verify declared WordPress requirements against the packaged dependency. */
require_once __DIR__ . '/plugin-identity.php';

function wconvertMinimumWordPress(string $path): string
{
    $header = @file_get_contents($path, false, null, 0, 8192);
    if ($header === false || preg_match_all('/^[ \t\/*#@]*Requires at least:[ \t]*([^\r\n]+)/mi', $header, $matches) !== 1) {
        throw new RuntimeException("Missing or ambiguous Requires at least header: {$path}");
    }
    $version = trim($matches[1][0]);
    if (!preg_match('/^\d+\.\d+(?:\.\d+)?$/D', $version)) {
        throw new RuntimeException("Invalid Requires at least header: {$path}");
    }
    return $version;
}

function wconvertVerifyWordPressRequirements(string $tree): void
{
    $identity = wconvertIdentify($tree);
    $minimum = wconvertMinimumWordPress($tree . '/' . $identity['main_file']);
    if ($identity['tier'] !== 'free') {
        return; // Action Scheduler is supplied by the required Free plugin.
    }
    if (version_compare($minimum, wconvertMinimumWordPress($tree . '/readme.txt'), '!=')) {
        throw new RuntimeException('WordPress minimum differs between wconvert.php and readme.txt.');
    }
    $dependency = wconvertMinimumWordPress($tree . '/vendor/woocommerce/action-scheduler/action-scheduler.php');
    if (version_compare($minimum, $dependency, '<')) {
        throw new RuntimeException("WordPress minimum {$minimum} is below bundled Action Scheduler requirement {$dependency}.");
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}

try {
    wconvertVerifyWordPressRequirements($argv[1] ?? '');
    echo "WordPress requirements verified.\n";
} catch (RuntimeException $failure) {
    fwrite(STDERR, $failure->getMessage() . "\n");
    exit(1);
}
