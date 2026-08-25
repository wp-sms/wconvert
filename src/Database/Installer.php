<?php

namespace WConvert\Database;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * Creates and upgrades WConvert's tables.
 *
 * Activation is not enough on its own: a plugin updated by overwriting its
 * directory — which is what every automatic update does — never fires an
 * activation hook, so a schema change would reach a site that never ran the
 * DDL for it. The version check on `plugins_loaded` is the half that covers
 * that, and it is one autoloaded option read on a request that changes nothing.
 *
 * @since 0.1.0
 */
final class Installer
{
    public const VERSION_OPTION = 'wconvert_db_version';

    /** Bump when {@see Schema} changes. */
    public const VERSION = '1';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    public function install(): void
    {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        dbDelta(Schema::sql($wpdb->prefix, $wpdb->get_charset_collate()));

        $this->options->set(self::VERSION_OPTION, self::VERSION);
    }

    public function upgradeIfNeeded(): void
    {
        if ($this->options->get(self::VERSION_OPTION) === self::VERSION) {
            return;
        }

        $this->install();
    }
}
