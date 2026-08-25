<?php

namespace WConvert\Storage;

defined('ABSPATH') || exit;

/**
 * {@see TransientStore} over WordPress transients.
 *
 * `get_transient()` returns `false` both for "absent" and for a stored
 * `false`, which is a WordPress wart rather than a distinction worth
 * preserving — so an absent value answers with the caller's default and the
 * caller never has to know which it was.
 *
 * @since 0.1.0
 */
final class WpTransientStore implements TransientStore
{
    /**
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        $value = get_transient($key);

        return $value === false ? $default : $value;
    }

    /**
     * @param mixed $value
     * @param positive-int $expiresIn
     */
    public function set(string $key, $value, int $expiresIn): void
    {
        set_transient($key, $value, $expiresIn);
    }
}
