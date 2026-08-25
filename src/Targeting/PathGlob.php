<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * The `url:` rule's glob, as a pure match over a request path.
 *
 * `*` is the ONLY metacharacter, and it matches any run of characters
 * including `/`. Everything else is a literal: a merchant typing a path with a
 * dot or a plus in it gets the path they typed, not a regular expression they
 * did not know they were writing.
 *
 * `?` is deliberately not a wildcard. In a URL it reads as the query-string
 * separator to every merchant alive, and a rule vocabulary this small cannot
 * afford a character that means one thing here and another everywhere else.
 *
 * Query strings never reach this: the path is the cache key, and a rule that
 * varied on `?utm_source=` would make the payload vary on it too.
 *
 * @since 0.1.0
 */
final class PathGlob
{
    public static function matches(string $pattern, string $path): bool
    {
        $pattern = self::normalize($pattern);

        // A trailing slash is not a targeting decision. WordPress serves
        // `/pricing/`, a merchant types `/pricing`, and an Optin that silently
        // fails to show over that difference is unexplainable from the admin.
        // So the pattern loses its trailing slash and regains it as optional.
        $regex = '';

        foreach (explode('*', $pattern) as $i => $literal) {
            $regex .= ($i > 0 ? '.*' : '') . preg_quote($literal, '#');
        }

        return preg_match('#^' . $regex . '/?$#i', $path) === 1;
    }

    private static function normalize(string $pattern): string
    {
        $pattern = trim($pattern);

        if (!str_starts_with($pattern, '/')) {
            $pattern = '/' . $pattern;
        }

        $trimmed = rtrim($pattern, '/');

        return $trimmed === '' ? '/' : $trimmed;
    }
}
