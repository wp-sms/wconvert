<?php
/**
 * gettext-calls.php — the one PHP reader of gettext call sites.
 *
 * Two jobs need to find a WordPress gettext call in PHP source and read its
 * arguments: pot-call-sites.php, behind `npm run check:pot` (did make-pot
 * extract it?), and any one-off rewrite of a call's domain. A second reader
 * would be a second function table, and the day somebody added `esc_xml__` to
 * one of them they would disagree about what a gettext call is. So the table
 * lives in bin/gettext-functions.json, which the JS/TS reader in
 * pot-coverage.mjs loads too, and the token walk lives here.
 *
 * Ported from WSMS 8's bin/lib/gettext-calls.php, unchanged but for the
 * prefix.
 *
 * WHY A TOKENIZER. A regex has no notion of a comment or of an argument
 * position; the tokenizer knows an argument slot from a string, and a
 * docblock that QUOTES `__('x', 'wconvert')` is not a call.
 *
 * WHAT COUNTS AS A LITERAL. An argument is a literal only when it is exactly one
 * string token and nothing else: `'a'` is, `'a' . $b`, `('a')`, `A_CONST` and
 * `$a` are not — each is something only running the code could decide, and a
 * guard says so by reporting null rather than by guessing.
 *
 * Plain functions, no autoloader and no WordPress: the callers are standalone
 * CLI scripts that boot nothing.
 */

declare(strict_types=1);

/**
 * gettext function => its argument positions, from bin/gettext-functions.json.
 *
 * @return array<string, array{msgid: int, domain: int, context?: int, plural?: int}>
 */
function wconvert_gettext_functions(): array
{
    static $functions = null;

    if ($functions === null) {
        $raw     = @file_get_contents(__DIR__ . '/gettext-functions.json');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($decoded) || !is_array($decoded['functions'] ?? null) || $decoded['functions'] === []) {
            fwrite(STDERR, "gettext-calls: cannot read bin/gettext-functions.json — refusing to guess the table.\n");
            exit(2);
        }
        $functions = $decoded['functions'];
    }

    return $functions;
}

/**
 * Every gettext call in $code.
 *
 * `args` maps each named part (msgid, plural, context, domain) to its decoded
 * value when that argument is a single string literal, and to null when it is
 * anything else — or absent. `lines` gives the line each literal sits on; `line`
 * is the function name's, which is the line make-pot writes into `#:`.
 *
 * @return list<array{line: int, fn: string, args: array<string, ?string>, lines: array<string, ?int>}>
 */
function wconvert_php_gettext_calls(string $code): array
{
    $tokens = @token_get_all($code);

    $functions = wconvert_gettext_functions();
    $count     = count($tokens);
    $calls     = [];

    for ($i = 0; $i < $count; $i++) {
        $token = $tokens[$i];
        if (!is_array($token)) {
            continue;
        }

        // PHP resolves function names case-insensitively, and `\__('x','wconvert')`
        // is the SAME global function written fully qualified — PHP 8 hands that
        // over as one T_NAME_FULLY_QUALIFIED token, so matching only T_STRING
        // would let both spellings through with a clean verdict. A namespaced
        // `Vendor\__()` (T_NAME_QUALIFIED) is somebody else's function and is
        // correctly ignored.
        $isName = $token[0] === T_STRING
            || (defined('T_NAME_FULLY_QUALIFIED') && $token[0] === T_NAME_FULLY_QUALIFIED);
        if (!$isName) {
            continue;
        }

        $name = strtolower(ltrim($token[1], '\\'));
        if (!isset($functions[$name])) {
            continue;
        }

        // It must be a CALL: the next significant token is an opening paren.
        $open = wconvert_next_significant($tokens, $i + 1, $count);
        if ($open === null || $tokens[$open] !== '(') {
            continue;
        }

        // ...and not a method call, a static call, or a declaration. `$obj->__()`
        // and `function __()` are somebody else's `__`, not WordPress'.
        $before = wconvert_prev_significant($tokens, $i - 1);
        if ($before !== null) {
            $prev = $tokens[$before];
            if (is_array($prev) && in_array($prev[0], [
                T_OBJECT_OPERATOR,
                T_NULLSAFE_OBJECT_OPERATOR,
                T_DOUBLE_COLON,
                T_FUNCTION,
                T_NEW,
                T_STRING,
            ], true)) {
                continue;
            }
        }

        $arguments = wconvert_call_arguments($tokens, $open, $count);
        $args      = [];
        $at        = [];
        foreach ($functions[$name] as $part => $position) {
            $slot = $arguments[$position] ?? [];
            // One significant token, and it is a string: anything else is not a
            // value this reader can know without running the code.
            if (count($slot) === 1 && is_array($tokens[$slot[0]]) && $tokens[$slot[0]][0] === T_CONSTANT_ENCAPSED_STRING) {
                $args[$part] = wconvert_php_string_value($tokens[$slot[0]][1]);
                $at[$part]   = $tokens[$slot[0]][2];
            } else {
                $args[$part] = null;
                $at[$part]   = null;
            }
        }

        $calls[] = ['line' => $token[2], 'fn' => $name, 'args' => $args, 'lines' => $at];
    }

    return $calls;
}

/**
 * The value a T_CONSTANT_ENCAPSED_STRING evaluates to.
 *
 * Single quotes know two escapes. Double quotes know the C set plus `\$`; a
 * double-quoted token with an interpolated variable is never this token type,
 * so there is nothing to evaluate.
 */
function wconvert_php_string_value(string $literal): string
{
    $quote = $literal[0];
    $body  = substr($literal, 1, -1);

    if ($quote === "'") {
        return strtr($body, ['\\\\' => '\\', "\\'" => "'"]);
    }

    return stripcslashes(str_replace('\\$', '$', $body));
}

/**
 * Index of the next token that is not whitespace or a comment.
 *
 * @param array<int, array{0:int,1:string,2:int}|string> $tokens
 */
function wconvert_next_significant(array $tokens, int $from, int $count): ?int
{
    for ($i = $from; $i < $count; $i++) {
        $token = $tokens[$i];
        if (is_array($token) && in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }

        return $i;
    }

    return null;
}

/**
 * Index of the previous token that is not whitespace or a comment.
 *
 * @param array<int, array{0:int,1:string,2:int}|string> $tokens
 */
function wconvert_prev_significant(array $tokens, int $from): ?int
{
    for ($i = $from; $i >= 0; $i--) {
        $token = $tokens[$i];
        if (is_array($token) && in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }

        return $i;
    }

    return null;
}

/**
 * Walk one call's argument list and record every significant token of each
 * argument, at any depth.
 *
 * @param array<int, array{0:int,1:string,2:int}|string> $tokens
 * @return array<int, list<int>>  1-based argument number => token indexes
 */
function wconvert_call_arguments(array $tokens, int $open, int $count): array
{
    $depth = 0;
    $arg   = 1;
    $found = [];

    for ($i = $open; $i < $count; $i++) {
        $token = $tokens[$i];

        if (is_array($token) && in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }

        // `[`/`{` are plain chars, but `${` and `{$` arrive as tokens and still
        // open a level that a `}` closes.
        $text = is_array($token) ? $token[1] : $token;
        if ($text === '(' || $text === '[' || $text === '{' || (is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
            $depth++;
            if ($depth > 1) {
                $found[$arg][] = $i;
            }
            continue;
        }

        if ($text === ')' || $text === ']' || $text === '}') {
            $depth--;
            if ($depth === 0) {
                break;
            }
            $found[$arg][] = $i;
            continue;
        }

        if ($text === ',' && $depth === 1) {
            $arg++;
            continue;
        }

        $found[$arg][] = $i;
    }

    return $found;
}
