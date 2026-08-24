<?php

/**
 * pro-php-scan.php — does free's PHP reference Pro?
 *
 *     php bin/pro-php-scan.php <path>...         (files or directories)
 *
 * Prints one `path:line: reference` per offender on stdout.
 * Exit 0 = clean, 1 = offenders, 2 = could not look.
 *
 * ADR 0029's check (a) is a CROSS PRODUCT — a `pro/` path OR the Pro
 * namespace, in TS AND PHP — so this looks for both halves:
 *
 *   1. The WConvert\Pro namespace, used as code.
 *   2. A `pro/` filesystem path pulled in by require/include.
 *
 * The second is not the lesser case. PHP reaches into another tree by PATH far
 * more often than TypeScript does, and `require_once WCONVERT_DIR . 'pro/…'`
 * is the shape a WordPress developer reaches for first.
 *
 * WHY THIS IS NOT A GREP, and WSMS learned it the expensive way (#241): the
 * question is "is this premium reference CODE, or prose in a comment?", and
 * that is a question about PHP that only PHP can answer. Free's source
 * legitimately DISCUSSES Pro — ADR references, a docblock explaining why an
 * accessor exists — and a regex flags every one of them, so the check that
 * cried wolf earns an exception list, and the exception list is what a real
 * leak eventually hides behind.
 *
 * So: comments and doc comments are NOT flagged. Code is. A namespace in a
 * STRING LITERAL still is, because a dynamic class name resolves it.
 */

declare(strict_types=1);

require_once __DIR__ . '/pro-scan-support.php';

const SCANNER = 'pro-php-scan';

/**
 * The namespace free may never reference, as segments.
 *
 * Compared segment by segment rather than as a string prefix, because
 * `WConvert\Promotions` starts with the characters of `WConvert\Pro` and is
 * not the Pro namespace. A prefix match would flag it, and the fix for a false
 * positive is always an exception — the one thing this must not acquire.
 */
const PRO_NAMESPACE = ['WConvert', 'Pro'];

/** Tokens that open an include expression. */
const INCLUDE_TOKENS = [T_REQUIRE, T_REQUIRE_ONCE, T_INCLUDE, T_INCLUDE_ONCE];

/**
 * Whether a qualified name names something inside the Pro namespace.
 */
function isProName(string $name): bool
{
    $segments = explode('\\', ltrim($name, '\\'));

    return array_slice($segments, 0, count(PRO_NAMESPACE)) === PRO_NAMESPACE;
}

/**
 * The value of a PHP string literal token, near enough to compare by.
 *
 * Only the backslash matters, and the two quote styles disagree about it: a
 * single-quoted 'WConvert\Pro\X' already holds single backslashes, while a
 * double-quoted "WConvert\\Pro\\X" holds doubled ones. Collapsing doubled
 * backslashes handles the second and leaves the first alone.
 *
 * Deliberately NOT stripcslashes(): `\P` is not a C escape, so it drops the
 * backslash and turns WConvert\Pro\Boot into WConvertProBoot — a name that
 * matches nothing, which is to say a leak reported as clean.
 */
function unquoteStringToken(string $text): string
{
    return str_replace('\\\\', '\\', trim($text, "'\""));
}

/**
 * Whether a string literal is a source path into the Pro tree.
 *
 * Two ways to qualify, and both are needed:
 *
 *   - it sits inside a require/include expression, or
 *   - it ends in .php, which catches the path built on one line and required
 *     on another.
 *
 * The gate matters as much as the match. Free links to the Pro landing page to
 * render a `locked` Availability state (ADR 0015), and 'https://wconvert.io/pro/'
 * has a `pro/` segment in it. Flagging every string with one would mean free
 * could not sell Pro without an exception list.
 */
function isProSourcePath(string $value, bool $insideInclude): bool
{
    if (!$insideInclude && !str_ends_with(strtolower($value), '.php')) {
        return false;
    }

    return pathReachesIntoPro($value);
}

$offenders = [];

foreach (collectFiles(scanPaths(SCANNER), SCANNER) as $file) {
    if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'php') {
        continue;
    }

    $source = readFileOrFail($file, SCANNER);
    $tokens = @token_get_all($source);

    if ($tokens === []) {
        fwrite(STDERR, SCANNER . ": could not tokenize: {$file}\n");
        exit(EXIT_CANNOT_LOOK);
    }

    $insideInclude = false;

    foreach ($tokens as $token) {
        // An include expression runs to the statement's semicolon. Everything
        // between is a path being pulled in, however it is concatenated.
        if ($token === ';') {
            $insideInclude = false;
            continue;
        }

        if (!is_array($token)) {
            continue;
        }

        [$id, $text, $line] = $token;

        if (in_array($id, INCLUDE_TOKENS, true)) {
            $insideInclude = true;
            continue;
        }

        // A qualified name in code — `use WConvert\Pro\X`, `\WConvert\Pro\X::y()`.
        if ($id === T_NAME_QUALIFIED || $id === T_NAME_FULLY_QUALIFIED || $id === T_NAME_RELATIVE) {
            if (isProName($text)) {
                $offenders[] = sprintf('%s:%d: %s', $file, $line, $text);
            }

            continue;
        }

        // T_COMMENT and T_DOC_COMMENT never reach here, on purpose: free is
        // allowed to talk about Pro, it is not allowed to reach into it.
        if ($id !== T_CONSTANT_ENCAPSED_STRING && $id !== T_ENCAPSED_AND_WHITESPACE) {
            continue;
        }

        $value = unquoteStringToken($text);

        if (isProName($value) || isProSourcePath($value, $insideInclude)) {
            $offenders[] = sprintf('%s:%d: %s', $file, $line, $value);
        }
    }
}

reportOffenders($offenders);
