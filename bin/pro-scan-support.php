<?php

/**
 * pro-scan-support.php — what the two Pro scanners share.
 *
 * ADR 0029 requires the three programs of the gate to be three PROGRAMS with
 * no flags between them, so that no opt-out exists to be taken on the day it
 * matters. That is a statement about entry points, not about file walkers:
 * two scanners hand-copying a directory traversal would drift, and a scanner
 * that drifts is one that quietly stops looking somewhere.
 *
 * Nothing here decides whether something is a violation. Each scanner owns its
 * own question; this owns finding the files to ask it about, and agreeing on
 * what the answers mean.
 */

declare(strict_types=1);

/** Clean: nothing found, and everything asked about was inspected. */
const EXIT_CLEAN = 0;

/** Violations found. Requires a non-empty offender list on stdout. */
const EXIT_OFFENDERS = 1;

/**
 * Could not look. NOT a pass — "couldn't look" reading as "clean" is how a
 * leak ships the one time a tree is incomplete (ADR 0029).
 */
const EXIT_CANNOT_LOOK = 2;

/** The directory segment free may never reach into. */
const PRO_SEGMENT = 'pro';

/**
 * The paths this scanner was asked to inspect.
 *
 * $argv exists only when register_argc_argv is on. It is on by default for the
 * CLI SAPI, but "by default" is not "always", and a scanner that silently saw
 * no paths would exit clean having read nothing — the precise fail-open this
 * gate refuses.
 *
 * @return list<string>
 */
function scanPaths(string $scanner): array
{
    $argv = $_SERVER['argv'] ?? null;

    if (!is_array($argv)) {
        fwrite(STDERR, "{$scanner}: cannot read command-line arguments (register_argc_argv off?)\n");
        exit(EXIT_CANNOT_LOOK);
    }

    /** @var list<string> $paths */
    $paths = array_values(array_map('strval', array_slice($argv, 1)));

    if ($paths === []) {
        fwrite(STDERR, "{$scanner}: no paths given\n");
        exit(EXIT_CANNOT_LOOK);
    }

    return $paths;
}

/**
 * Every file under the given paths, which may themselves be files or
 * directories. A path that cannot be read ends the scan as could-not-look.
 *
 * @param list<string> $paths
 * @return list<string>
 */
function collectFiles(array $paths, string $scanner): array
{
    $files = [];

    foreach ($paths as $path) {
        if (is_file($path)) {
            $files[] = $path;
            continue;
        }

        if (!is_dir($path) || !is_readable($path)) {
            fwrite(STDERR, "{$scanner}: not a readable file or directory: {$path}\n");
            exit(EXIT_CANNOT_LOOK);
        }

        $walker = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        /** @var SplFileInfo $entry */
        foreach ($walker as $entry) {
            if ($entry->isFile()) {
                $files[] = $entry->getPathname();
            }
        }
    }

    sort($files);

    return $files;
}

/**
 * Read a file, or end the scan as could-not-look.
 */
function readFileOrFail(string $file, string $scanner): string
{
    $source = @file_get_contents($file);

    if ($source === false) {
        fwrite(STDERR, "{$scanner}: unreadable file: {$file}\n");
        exit(EXIT_CANNOT_LOOK);
    }

    return $source;
}

/**
 * Whether a path reaches into the Pro tree.
 *
 * `pro` must be a WHOLE segment with something after it, so `repro/x`,
 * `improved/y` and a file named `pro.ts` are not matches. A leading `@` is
 * stripped first, because an alias behaves as a root: `@pro/x` and `pro/x`
 * make the same claim.
 */
function pathReachesIntoPro(string $path): bool
{
    $segments = explode('/', ltrim($path, '@'));

    // The last segment names the module or file, not a directory, so a path
    // ending in `pro` reaches into nothing.
    array_pop($segments);

    return in_array(PRO_SEGMENT, $segments, true);
}

/**
 * Print the offenders and exit with the verdict they imply.
 *
 * @param list<string> $offenders
 */
function reportOffenders(array $offenders): never
{
    if ($offenders === []) {
        exit(EXIT_CLEAN);
    }

    $offenders = array_values(array_unique($offenders));
    sort($offenders);

    echo implode("\n", $offenders), "\n";

    exit(EXIT_OFFENDERS);
}

/**
 * The 1-based line a byte offset falls on.
 */
function lineAt(string $source, int $offset): int
{
    return substr_count(substr($source, 0, $offset), "\n") + 1;
}
