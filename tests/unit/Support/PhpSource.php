<?php

namespace WConvert\Tests\Unit\Support;

/**
 * PHP source with its comments removed.
 *
 * Two tests in this suite read source text rather than behaviour, because the
 * failure each guards against is a line someone ADDS and no assertion about
 * output can see a rule that is currently being kept
 * ({@see \WConvert\Tests\Unit\Frontend\NoSecondCacheTest},
 * {@see \WConvert\Tests\Unit\Contract\NoLicenceOnTheFrontEndTest}).
 *
 * Both need the same thing first: **this codebase explains at length why it
 * does not do the things those tests forbid**, so the explanation must not read
 * as the violation. `WpProPresence`'s header says the word "licence" four
 * times, and a scan that could not tell a comment from a call would fail on the
 * file that is getting it right.
 */
final class PhpSource
{
    /**
     * Read a file, and return the code without its comments.
     *
     * Tokenised rather than regexed: a comment ends where PHP says it ends,
     * and "licence" inside a string literal is code — which is the case that
     * matters, since a licence read is `get_option('…_licence_key')`.
     */
    public static function code(string $file): string
    {
        $code = '';

        foreach (token_get_all((string) file_get_contents($file)) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            $code .= is_array($token) ? $token[1] : $token;
        }

        return $code;
    }
}
