<?php

namespace WConvert\Storage;

defined('ABSPATH') || exit;

/**
 * {@see OptionStore} over WordPress options, never autoloaded.
 *
 * `autoload=false` on every write: what goes through here is payload-sized and
 * has no business in `alloptions` on every admin request (ADR 0003).
 *
 * @since 0.1.0
 */
final class WpOptionStore implements OptionStore
{
    /**
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        return get_option($key, $default);
    }

    /**
     * @param mixed $value
     */
    public function set(string $key, $value): void
    {
        update_option($key, $value, false);
    }
}
