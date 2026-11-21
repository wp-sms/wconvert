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
 * **A write can fail, and says so.** A `wp_options` table that refuses a value
 * (utf8mb3 refusing an emoji is the case that happened, #424) used to fail
 * silently, and the published set stayed at its old value while the editor
 * reported the campaign live. `set()` answers false when the table does not
 * hold what was asked for, and a caller with someone to tell, tells them.
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
     * @return bool Whether the stored value is now `$value`.
     */
    public function set(string $key, $value): bool;
}
