<?php

/**
 * pro-ts-scan.php — does free's TypeScript import a `pro/` path?
 *
 *     php bin/pro-ts-scan.php <path>...          (files or directories)
 *
 * Prints one `path:line: specifier` per offending import on stdout.
 * Exit 0 = clean, 1 = offenders, 2 = could not look.
 *
 * WHY THIS IS NOT A GREP. The question is "is this module specifier a path
 * under pro/?", and a substring match answers a different one: `repro/x` and
 * `improved/y` both contain the characters `pro/` and neither is a leak, while
 * `@pro/z` looks nothing like a relative path and is one. The distinction is a
 * path SEGMENT boundary, which is a property of the specifier rather than of
 * the line it sits on — so the specifier is extracted first and judged second.
 */

declare(strict_types=1);

require_once __DIR__ . '/pro-scan-support.php';

const SCANNER = 'pro-ts-scan';

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

$offenders = [];

foreach (collectFiles(scanPaths(SCANNER), SCANNER) as $file) {
    if (!in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), SCANNED_EXTENSIONS, true)) {
        continue;
    }

    $source = readFileOrFail($file, SCANNER);

    foreach (SPECIFIER_PATTERNS as $pattern) {
        if (preg_match_all($pattern, $source, $matches, PREG_OFFSET_CAPTURE) === false) {
            fwrite(STDERR, SCANNER . ": pattern failed on {$file}\n");
            exit(EXIT_CANNOT_LOOK);
        }

        foreach ($matches[2] as $match) {
            [$specifier, $offset] = $match;

            if (pathReachesIntoPro($specifier)) {
                $offenders[] = sprintf('%s:%d: %s', $file, lineAt($source, (int) $offset), $specifier);
            }
        }
    }
}

reportOffenders($offenders);
