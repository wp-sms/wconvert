<?php

namespace WConvert\Storage;

defined('ABSPATH') || exit;

/**
 * A WordPress transient, as a seam — beside {@see OptionStore} and
 * deliberately not folded into it.
 *
 * The two are not the same storage wearing different names. An option is
 * derived state that must never miss: ADR 0003 rejected a transient under the
 * published set precisely because an object-cache-backed transient can be
 * evicted at any moment, and an eviction there lands a cold database query on
 * an uncached page load. What belongs HERE is the opposite kind of value — one
 * whose whole meaning is that it expires, and whose loss costs nothing.
 *
 * The values here are short-lived public-endpoint rate-limit windows. Losing
 * one lets a caller's allowance start again, which is the same outcome as
 * waiting for that window to expire.
 *
 * The expiry is a REQUIRED argument rather than an optional one. A transient
 * written without one never expires and is an option with a worse name, which
 * is the mistake this interface exists to make unspellable.
 *
 * @since 0.1.0
 */
interface TransientStore
{
    /**
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null);

    /**
     * @param mixed $value
     * @param positive-int $expiresIn Seconds.
     */
    public function set(string $key, $value, int $expiresIn): void;
}
