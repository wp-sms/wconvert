<?php

namespace WConvert\Storage;

defined('ABSPATH') || exit;

/**
 * A WordPress option, as a seam.
 *
 * Narrow on purpose: the published set is the only thing behind it, and it is
 * always written whole and read whole.
 *
 * @since 0.1.0
 */
interface OptionStore
{
    /**
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null);

    /**
     * @param mixed $value
     */
    public function set(string $key, $value): void;
}
