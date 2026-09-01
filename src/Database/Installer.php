<?php

namespace WConvert\Database;

use WConvert\Optin\OptinRepository;
use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * Creates and upgrades WConvert's tables, and rebuilds the derived state that
 * a new version's code would otherwise read at an old version's shape.
 *
 * Activation is not enough on its own: a plugin updated by overwriting its
 * directory — which is what every automatic update does — never fires an
 * activation hook, so a schema change would reach a site that never ran the
 * DDL for it. {@see \WConvert\Container\CoreServiceProvider} covers that by
 * calling {@see self::upgradeIfNeeded()} on `admin_init`, deliberately NOT on
 * the front end: the version option is not autoloaded, so reading it there
 * would be a database query on every uncached page load.
 *
 * ============================================================================
 * THIS RE-RUNS THE CURRENT DDL. IT DOES NOT REPLAY A CHAIN OF STEPS.
 * ============================================================================
 * That is what makes **skipping versions free**: 0.1 → 1.5 costs exactly what
 * 1.4 → 1.5 costs, because there is one statement and it describes the shape
 * the code in front of you expects. A stepwise runner would give that up, and
 * the version this class stores already says which version a site is coming
 * *from* — so one can arrive in the release that first needs one, rather than
 * being built now against a need nobody has.
 *
 * What `dbDelta` cannot do is worth knowing before relying on this: it **adds
 * and alters, and never removes**. A dropped column or index needs a raw
 * `ALTER`, which is a thing this plugin deliberately has nowhere to put, so
 * removing either from {@see Schema} means a fresh install stops creating it
 * and an existing install keeps a harmless orphan.
 *
 * @since 0.1.0
 */
final class Installer
{
    public const VERSION_OPTION = 'wconvert_db_version';

    /**
     * Bump when {@see Schema} changes — **or when the published projection
     * does.**
     *
     * The second half is new with the rebuild in {@see self::install()}. This
     * value is the whole trigger for that rebuild, so a change to what
     * {@see \WConvert\Optin\PublishedProjection} produces that does not bump it
     * is a change no existing site ever receives.
     *
     * `4`: `parent_id` on `wconvert_optins`, `idx_goal` removed, and the
     * published set narrowed to an allowlist.
     */
    public const VERSION = '4';

    public function __construct(
        private readonly OptionStore $options,
        private readonly OptinRepository $optins,
    ) {
    }

    public function install(): void
    {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        dbDelta(Schema::sql($wpdb->prefix, $wpdb->get_charset_collate()));

        // ====================================================================
        // THE ONE DATA STEP, AND THE REASON THERE NEEDS TO BE ONE.
        // ====================================================================
        // Everything else WConvert stores is normalised on write against a
        // closed vocabulary and read tolerantly with defaults, which is what
        // lets schemas and shapes change without a migration ever running.
        // The published set is the exception, because nothing writes it on its
        // own: ADR 0003 rebuilds it on write and never on read, so an Optin
        // published once and never edited again keeps whatever shape the
        // projection had that day — indefinitely, and invisibly.
        //
        // Rebuilt here rather than tagged with a version on the wire. The
        // loader's `payload.ts` is defensive throughout and null is a real
        // answer everywhere in it, so the browser tolerating an old shape is
        // already the design; what was missing was anything that ever produced
        // a new one.
        //
        // AFTER the DDL and BEFORE the version is stored. The rebuild reads
        // the table `dbDelta` has just brought up to date, and leaving the
        // version unwritten if it fails is what makes the next `admin_init`
        // try again rather than record a half-done upgrade as finished.
        $this->optins->rebuildForInstall();

        $this->options->set(self::VERSION_OPTION, self::VERSION);
    }

    /**
     * **Compared with `!==`, so a downgrade re-runs too**, and that is benign
     * rather than merely tolerated: an older build re-runs its own DDL, which
     * `dbDelta` reconciles without touching the newer column, and rebuilds the
     * published set at the shape that build's projection actually produces.
     * Which is what a site running that build needs.
     */
    public function upgradeIfNeeded(): void
    {
        if ($this->options->get(self::VERSION_OPTION) === self::VERSION) {
            return;
        }

        $this->install();
    }
}
