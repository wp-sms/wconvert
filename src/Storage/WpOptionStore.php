<?php

namespace WConvert\Storage;

defined('ABSPATH') || exit;

/**
 * {@see OptionStore} over WordPress options, never autoloaded.
 *
 * `autoload=false` on every write: what goes through here is payload-sized and
 * has no business in `alloptions` on every admin request (ADR 0003).
 *
 * ============================================================================
 * AN ARRAY IS STORED AS ASCII JSON, NOT AS A SERIALISED PHP ARRAY (ADR 0192).
 * ============================================================================
 * On a site whose `wp_options` table is utf8mb3, WordPress will not store a
 * 4-byte character. `wpdb::process_fields()` strips it, sees that the value
 * changed, and returns false **without sending a query**. A serialised array
 * holding merchant text with an emoji in it is therefore never written, and
 * the published set froze on every such site (#424).
 *
 * `wp_json_encode()` with its default flags escapes everything above ASCII as
 * `\uXXXX`, so what reaches the table is ASCII whatever the column's charset.
 * Scalars go in as they are: every scalar stored here is a flag, a number or
 * `'yes'`/`'no'`.
 *
 * Reading back, a string that decodes to an array is that array. Anything else
 * is returned as stored, which is also how an array written the old way reads:
 * `get_option()` has already unserialised it.
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
        $value = get_option($key, $default);

        if (!is_string($value) || $value === '' || ($value[0] !== '[' && $value[0] !== '{')) {
            return $value;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : $value;
    }

    /**
     * **False means the table does not hold the value.** `update_option()`
     * answers false both for a refused write and for a value that did not
     * change, so a false from it is checked against what is now stored.
     *
     * @param mixed $value
     */
    public function set(string $key, $value): bool
    {
        if (is_array($value)) {
            $value = wp_json_encode($value);

            if ($value === false) {
                return false;
            }
        }

        if (update_option($key, $value, false)) {
            return true;
        }

        $stored = get_option($key, null);

        // A number comes back from the table as a string, so `1` is stored
        // when the table holds `'1'`.
        return is_scalar($value) && is_scalar($stored)
            ? (string) $stored === (string) $value
            : $stored === $value;
    }
}
