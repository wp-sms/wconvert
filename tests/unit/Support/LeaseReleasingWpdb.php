<?php

namespace WConvert\Tests\Unit\Support;

/**
 * `$wpdb`, performing the one statement a lease release issues.
 *
 * {@see \WConvert\Discovery\OccasionStore} releases its lock with a
 * compare-and-delete that `delete_option()` cannot express, so without this
 * the first write would leave the lock behind and every later write in the
 * same test would read as "another change is being saved".
 */
final class LeaseReleasingWpdb extends \wpdb
{
    public string $options = 'wp_options';

    public function query(string $sql): int
    {
        parent::query($sql);
        $last = end($this->prepared);
        if (str_starts_with($sql, 'DELETE FROM') && $last !== false) {
            [$key, $value] = $last['args'];
            if (array_key_exists($key, $GLOBALS['wconvertTestOptionTable']) && maybe_serialize($GLOBALS['wconvertTestOptionTable'][$key]) === $value) {
                unset($GLOBALS['wconvertTestOptionTable'][$key]);
                return 1;
            }
            return 0;
        }
        return 1;
    }
}
