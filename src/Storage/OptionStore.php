<?php

namespace WConvert\Storage;

defined('ABSPATH') || exit;

/**
 * A WordPress option, as a seam.
 *
 * Narrow on purpose. Everything behind it is written whole and read whole —
 * the published set, the schema version, and the retention period — so a
 * partial update is not an operation this can express.
 *
 * It originally said the published set was the only thing behind it. #25 added
 * the second and third, and neither widened the interface: a period is one
 * integer for the whole site, which is exactly the shape this already served
 * (ADR 0003, ADR 0018).
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
