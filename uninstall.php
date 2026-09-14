<?php
/**
 * Deleting WConvert removes WConvert.
 *
 * ============================================================================
 * THIS DESTROYS DATA, ON PURPOSE, WITH NO OPT-OUT SETTING.
 * ============================================================================
 * Three tables, eleven options and the installed pack archive, every time. Uninstalling is not
 * deactivating: `Bootstrap::deactivate()` deliberately touches no data at all,
 * because a merchant switching the plugin off has not asked for their [[Lead]]s
 * to be destroyed (ADR 0018). Deleting the plugin is a separate act, behind
 * WordPress's own confirmation, and it means what it says.
 *
 * A keep-by-default setting was considered and rejected. Clean removal is what
 * the plugin handbook asks for, what wp.org reviewers raise, and what a
 * merchant who has decided means; a checkbox would leave three tables behind on
 * most sites forever to serve a case WordPress already warns about twice.
 *
 * **The risk it accepts is narrow and real** — a merchant who deletes to
 * troubleshoot loses their lead log — so it is named where somebody will read
 * it before acting rather than only here: `readme.txt` says it under
 * Installation and again in the FAQ, beside the CSV export that is how you
 * take the data out first.
 *
 * ============================================================================
 * A FILE, NOT `register_uninstall_hook()`.
 * ============================================================================
 * WordPress includes this file with the plugin NOT loaded, so nothing in
 * `src/` runs, no autoloader is registered and no service container exists.
 * That is the property worth having: the one operation that destroys a
 * merchant's data is the one that runs the least code. The names below are
 * therefore spelled out rather than read off the constants that own them, and
 * `tests/unit/Database/UninstallTest.php` is what keeps the two copies in
 * step — it reads every `const OPTION` in both trees and every `TABLE_` on
 * `Connection`, and fails on one this file does not name.
 *
 * @since 0.1.0
 */

// The only guard. WordPress defines this immediately before including the
// file, so its absence means something else asked for this to run.
defined('WP_UNINSTALL_PLUGIN') || exit;

global $wpdb;

/*
 * Every option WConvert writes.
 *
 * All eleven are `autoload=false` (WpOptionStore hard-codes it), so none of
 * them is in `alloptions` and each is one row of its own.
 */
$wconvertOptions = [
    // Database\Installer::VERSION_OPTION — the schema version. Deleted so that
    // a reinstall re-runs the DDL against tables that are no longer there,
    // rather than reading a version and believing the schema is current.
    'wconvert_db_version',
    // Optin\PublishedSet::OPTION — the published projection. Derived state,
    // rebuilt from a table that is about to be dropped.
    'wconvert_published_set',
    // Retention\RetentionPeriod::OPTION
    'wconvert_retention_days',
    // Optin\SiteFrequency::OPTION — the allowance the whole site shares.
    'wconvert_site_frequency',
    // Milestone\MilestoneStore::OPTION — the two milestones nothing else can
    // answer: the day this site first published, and the first [[Playbook]]
    // suggestion a merchant overrode. Site-owned facts that never left the
    // site, and they leave with it.
    'wconvert_milestones',
    // Destination\DestinationStore::OPTION
    'wconvert_destinations',
    // Destination\ConnectionStore::OPTION — carries credentials, which is the
    // one option here it would be actively wrong to leave behind.
    'wconvert_connections',
    // Destination\HealthStore::OPTION
    'wconvert_destination_health',
    // Destination\DeliveryFailures::OPTION
    'wconvert_delivery_failures',
    // Template\Catalog\TemplateCatalog::{CACHE_OPTION,SOURCE_OPTION}
    'wconvert_template_catalog_cache',
    'wconvert_template_catalog_url',
];

foreach ($wconvertOptions as $wconvertOption) {
    delete_option($wconvertOption);
}

// The installer creates a flat archive of content-addressed JSON and temporary
// .pack-* files. Never recurse into directories or follow an archive symlink.
$wconvertUploads = wp_upload_dir(null, false);
$wconvertPackDirectory = $wconvertUploads['basedir'] . '/wconvert-template-packs';
if (is_dir($wconvertPackDirectory) && !is_link($wconvertPackDirectory)) {
    foreach (scandir($wconvertPackDirectory) ?: [] as $wconvertPackFile) {
        if (preg_match('/^(?:[a-f0-9]{64}\.json|\.pack-[A-Za-z0-9]+)$/D', $wconvertPackFile) !== 1) continue;
        $wconvertPackPath = $wconvertPackDirectory . '/' . $wconvertPackFile;
        if (is_file($wconvertPackPath) || is_link($wconvertPackPath)) @unlink($wconvertPackPath);
    }
    // An unrelated file placed here by the site owner is preserved.
    @rmdir($wconvertPackDirectory);
}

/*
 * Every table WConvert creates — and only those.
 *
 * ACTION SCHEDULER'S TABLES ARE NOT DROPPED, and must never be. WConvert
 * bundles it as a core dependency, but so do WooCommerce and WSMS, and the
 * newest copy on the site wins the version negotiation regardless of which
 * plugin shipped it. Dropping `actionscheduler_*` here would delete another
 * plugin's queue.
 *
 * The prefixed name goes through `%i`, the identifier placeholder, rather than
 * being concatenated into the statement — the same rule
 * `WConvert\Database\WpdbConnection` follows for every query it makes, and the
 * reason the plugin's floor is WordPress 6.2. `Connection` itself is not used:
 * it has no `drop()`, its `delete()` refuses anything that is not a `DELETE`,
 * and widening that interface for a file that runs with the plugin unloaded
 * would be a third widening its own docblock argues against.
 */
$wconvertTables = [
    // Database\Connection::TABLE_OPTINS
    'wconvert_optins',
    // Database\Connection::TABLE_LEADS
    'wconvert_leads',
    // Database\Connection::TABLE_STATS
    'wconvert_stats',
];

foreach ($wconvertTables as $wconvertTable) {
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- dropping a table is not expressible any other way, and the identifier is bound as %i.
    $wpdb->query($wpdb->prepare('DROP TABLE IF EXISTS %i', $wpdb->prefix . $wconvertTable));
}

/*
 * WHAT IS DELIBERATELY NOT HERE.
 *
 * - **The pruner's cron event.** WordPress deactivates a plugin before it
 *   uninstalls it, so `Bootstrap::deactivate()` has already cleared it. Doing
 *   it again would need `wp_clear_scheduled_hook()` against a hook name spelled
 *   a second time, for an event that is already gone.
 * - **The beacon's rate-limit transients.** They are `wconvert_beacon_`-prefixed
 *   transients holding a hashed address for a few minutes and they expire on
 *   their own; finding them means a `LIKE` scan of the options table, which is
 *   a table scan on the biggest table on the site to delete rows that are about
 *   to delete themselves.
 * - **The other sites of a multisite network.** Multisite is out of scope for
 *   v1 and WConvert is meant to be activated per site, so this cleans the site
 *   it was asked about — the same scope its activation, its options and its
 *   tables all have (`Bootstrap::activate()`).
 */
