<?php

/**
 * pro-ns-scan.php — does any PHP file under this tree USE the Pro namespace?
 *
 *     php bin/pro-ns-scan.php <path>...          (files or directories)
 *
 * Prints one `path:line: name` per offending reference on stdout.
 * Exit 0 = clean, 1 = offenders (stdout non-empty), 2 = could not look.
 *
 * WHY THIS IS NOT A GREP, and WSMS learned it the expensive way (#241): the
 * question is "is this premium namespace CODE, or prose in a comment?", and
 * that is a question about PHP that only PHP can answer. Free's source
 * legitimately DISCUSSES Pro — ADR references, a docblock explaining why an
 * accessor exists — and a regex flags every one of them, so the check that
 * cried wolf gets an exception list, and the exception list is what a real
 * leak eventually hides behind.
 *
 * So: comments and doc comments are NOT flagged. Code is. A name in a STRING
 * LITERAL still is, because a dynamic class name resolves it.
 */

declare(strict_types=1);

const EXIT_CLEAN = 0;
const EXIT_OFFENDERS = 1;
const EXIT_CANNOT_LOOK = 2;

/**
 * The namespace free may never reference, as segments.
 *
 * Compared segment by segment rather than as a string prefix, because
 * `WConvert\Promotions` starts with the characters of `WConvert\Pro` and is
 * not the Pro namespace. A prefix match would flag it, and the fix for a false
 * positive is always an exception, which is the thing this must not acquire.
 */
const PRO_NAMESPACE = ['WConvert', 'Pro'];

/*
 * $argv exists only when register_argc_argv is on. It is on by default for the
 * CLI SAPI, but "by default" is not "always", and a scanner that silently saw
 * no paths would exit clean having read nothing — the precise fail-open this
 * gate refuses. Read it off $_SERVER, and treat its absence as could-not-look.
 */
$argv = $_SERVER['argv'] ?? null;

if (!is_array($argv)) {
    fwrite(STDERR, "pro-ns-scan: cannot read command-line arguments (register_argc_argv off?)\n");
    exit(EXIT_CANNOT_LOOK);
}

/** @var list<string> $paths */
$paths = array_values(array_map('strval', array_slice($argv, 1)));

if ($paths === []) {
    fwrite(STDERR, "pro-ns-scan: no paths given\n");
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
 * The value of a PHP string literal token, near enough to compare names by.
 *
 * Only the backslash matters here, and the two quote styles disagree about it:
 * a single-quoted 'WConvert\Pro\X' already holds single backslashes, while a
 * double-quoted "WConvert\\Pro\\X" holds doubled ones. Collapsing doubled
 * backslashes handles the second and leaves the first alone.
 *
 * Deliberately NOT stripcslashes(): `\P` is not a C escape, so it drops the
 * backslash and turns WConvert\Pro\Boot into WConvertProBoot — a name that
 * matches nothing, which is to say a leak reported as clean.
 */
function unquoteStringToken(string $text): string
{
    $inner = trim($text, "'\"");

    return str_replace('\\\\', '\\', $inner);
}

function isProName(string $name): bool
{
    $segments = explode('\\', ltrim($name, '\\'));

    return array_slice($segments, 0, count(PRO_NAMESPACE)) === PRO_NAMESPACE;
}

$offenders = [];

$files = collectFiles($paths, 'pro-ns-scan');

foreach ($files as $file) {
    if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'php') {
        continue;
    }

    $source = @file_get_contents($file);

    if ($source === false) {
        fwrite(STDERR, "pro-ns-scan: unreadable file: {$file}\n");
        exit(EXIT_CANNOT_LOOK);
    }

    $tokens = @token_get_all($source);

    if ($tokens === []) {
        fwrite(STDERR, "pro-ns-scan: could not tokenize: {$file}\n");
        exit(EXIT_CANNOT_LOOK);
    }

    foreach ($tokens as $token) {
        if (!is_array($token)) {
            continue;
        }

        [$id, $text, $line] = $token;

        $candidate = match ($id) {
            // A qualified name in code — `use WConvert\Pro\X`, `\WConvert\Pro\X::y()`.
            T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_NAME_RELATIVE => $text,
            // A name in a string literal: `new $class` where $class is one of
            // these resolves it just as surely as writing it out.
            T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE => unquoteStringToken($text),
            // T_COMMENT and T_DOC_COMMENT fall through here on purpose — free
            // is allowed to talk about Pro, it is not allowed to call into it.
            default => null,
        };

        if ($candidate === null || !isProName($candidate)) {
            continue;
        }

        $offenders[] = sprintf('%s:%d: %s', $file, $line, $candidate);
    }
}

if ($offenders !== []) {
    $offenders = array_values(array_unique($offenders));
    sort($offenders);
    echo implode("\n", $offenders), "\n";
    exit(EXIT_OFFENDERS);
}

exit(EXIT_CLEAN);
