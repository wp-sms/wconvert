<?php

/**
 * pro-import-scan.php — does any TypeScript/JavaScript file under this tree
 * import a `pro/` path?
 *
 *     php bin/pro-import-scan.php <path>...      (files or directories)
 *
 * Prints one `path:line: specifier` per offending import on stdout.
 * Exit 0 = clean, 1 = offenders (stdout non-empty), 2 = could not look.
 *
 * WHY THIS IS NOT A GREP. The question is "is this module specifier a path
 * under pro/?", and a substring match answers a different one. `repro/x` and
 * `improved/y` both contain the characters `pro/` and neither is a leak;
 * `@pro/z` does not look like a relative path and is one. The distinction is
 * a path SEGMENT boundary, which is a property of the specifier rather than
 * of the line it sits on — so the specifier is extracted first and judged
 * second. WSMS learned the same lesson one layer over, replacing its premium
 * namespace regex with a tokenizer because prose in a comment is not code.
 */

declare(strict_types=1);

const EXIT_CLEAN = 0;
const EXIT_OFFENDERS = 1;
const EXIT_CANNOT_LOOK = 2;

/** The namespace-like directory whose contents free may never import. */
const PRO_SEGMENT = 'pro';

/** Extensions that can carry a module specifier. */
const SCANNED_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];

/**
 * Every form that binds a module specifier: static import/export, dynamic
 * import(), and require(). The specifier is capture group 2.
 */
const SPECIFIER_PATTERNS = [
    '/\b(?:import|export)\b[^;\n]*?\bfrom\s*(["\'])(.*?)\1/',
    '/\bimport\s*(["\'])(.*?)\1/',
    '/\bimport\s*\(\s*(["\'])(.*?)\1/',
    '/\brequire\s*\(\s*(["\'])(.*?)\1/',
];

/*
 * $argv exists only when register_argc_argv is on. It is on by default for the
 * CLI SAPI, but "by default" is not "always", and a scanner that silently saw
 * no paths would exit clean having read nothing — the precise fail-open this
 * gate refuses. Read it off $_SERVER, and treat its absence as could-not-look.
 */
$argv = $_SERVER['argv'] ?? null;

if (!is_array($argv)) {
    fwrite(STDERR, "pro-import-scan: cannot read command-line arguments (register_argc_argv off?)\n");
    exit(EXIT_CANNOT_LOOK);
}

/** @var list<string> $paths */
$paths = array_values(array_map('strval', array_slice($argv, 1)));

if ($paths === []) {
    fwrite(STDERR, "pro-import-scan: no paths given\n");
    exit(EXIT_CANNOT_LOOK);
}

/**
 * Every file under the given paths, which may be files or directories.
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
 * Whether a module specifier resolves to something under a `pro/` directory.
 *
 * True when `pro` is a whole segment of the specifier's path and something
 * follows it. That accepts `pro/x`, `../../pro/x` and `@pro/x` as leaks, and
 * rejects `repro/x`, `improved/y` and a file literally named `pro.ts`, which
 * are all free paths that merely share the letters.
 */
function importsPro(string $specifier): bool
{
    // An alias behaves as a root, so `@pro/x` and `pro/x` are the same claim.
    $path = ltrim($specifier, '@');

    $segments = explode('/', $path);

    // The last segment is the module, not a directory, so a specifier ending
    // in `pro` names a file called pro and imports nothing under a pro tree.
    array_pop($segments);

    return in_array(PRO_SEGMENT, $segments, true);
}

$offenders = [];

$files = collectFiles($paths, 'pro-import-scan');

foreach ($files as $file) {
    if (!in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), SCANNED_EXTENSIONS, true)) {
        continue;
    }

    $source = @file_get_contents($file);

    if ($source === false) {
        // A file inside the tree that cannot be read is exactly the case this
        // whole gate refuses to wave through.
        fwrite(STDERR, "pro-import-scan: unreadable file: {$file}\n");
        exit(EXIT_CANNOT_LOOK);
    }

    foreach (SPECIFIER_PATTERNS as $pattern) {
        if (preg_match_all($pattern, $source, $matches, PREG_OFFSET_CAPTURE) === false) {
            fwrite(STDERR, "pro-import-scan: pattern failed on {$file}\n");
            exit(EXIT_CANNOT_LOOK);
        }

        foreach ($matches[2] as $match) {
            [$specifier, $offset] = $match;

            if (!importsPro($specifier)) {
                continue;
            }

            $line = substr_count(substr($source, 0, (int) $offset), "\n") + 1;
            $offenders[] = sprintf('%s:%d: %s', $file, $line, $specifier);
        }
    }
}

if ($offenders !== []) {
    $offenders = array_values(array_unique($offenders));
    sort($offenders);
    echo implode("\n", $offenders), "\n";
    exit(EXIT_OFFENDERS);
}

exit(EXIT_CLEAN);
