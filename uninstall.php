<?php
/**
 * Deleting WConvert removes WConvert.
 *
 * ============================================================================
 * THIS DESTROYS DATA, ON PURPOSE, WITH NO OPT-OUT SETTING.
 * ============================================================================
 * Three tables, every option, the installed pack and image archives, the
 * private import folder and every scheduled job, every time. Uninstalling is not
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
 * Every one is `autoload=false` (WpOptionStore hard-codes it), so none of
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
    // Privacy\PrivacyGuidance::OPTION — authoring help for new Campaign drafts.
    'wconvert_privacy_guidance',
    // Optin\SiteFrequency::OPTION — the allowance the whole site shares.
    'wconvert_site_frequency',
    // Stats\MonthlyTargets::OPTION — optional site-owned monthly benchmarks.
    'wconvert_monthly_targets',
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
    'wconvert_protection',
    // Destination\HealthStore::OPTION
    'wconvert_destination_health',
    // Destination\DeliveryFailures::OPTION
    'wconvert_delivery_failures',
    // Template\Catalog\TemplateCatalog::{CACHE_OPTION,SOURCE_OPTION}
    'wconvert_template_catalog_cache',
    'wconvert_template_catalog_url',
    'wconvert_picker_occasions',
    // Optin\PhoneCountry::OPTION — the phone field's default country.
    'wconvert_phone_default_country',
];

foreach ($wconvertOptions as $wconvertOption) {
    delete_option($wconvertOption);
}

/*
 * The files WConvert writes, by name and only by name.
 *
 * Each folder is emptied of the names WConvert gives its own files and then
 * removed if that left it empty. Never recursive and never through a link:
 * an unrelated file a site owner put in one of these folders is kept, and so
 * is the folder holding it. rmdir() is PHP's because WordPress has no
 * function for an empty folder that is not a WP_Filesystem connection, which
 * may be FTP and cannot reach the temp directory at all.
 */
$wconvertRemoveOwned = static function (string $directory, string $pattern): void {
    if (!is_dir($directory) || is_link($directory)) return;
    foreach (scandir($directory) ?: [] as $file) {
        if (preg_match($pattern, $file) !== 1) continue;
        $path = $directory . '/' . $file;
        if (is_file($path) || is_link($path)) wp_delete_file($path);
    }
    if ((scandir($directory) ?: []) === ['.', '..']) {
        rmdir($directory); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- see above.
    }
};
$wconvertUploads = wp_upload_dir(null, false);

// Template\Catalog\InstalledPacks — content-addressed JSON and staged .pack-* files.
$wconvertRemoveOwned($wconvertUploads['basedir'] . '/wconvert-template-packs', '/^(?:[a-f0-9]{64}\.json|\.pack-[A-Za-z0-9]+)$/D');

// Template\Catalog\VerifiedAssets — images by digest under free/ and premium/,
// a marker per pack under sets/, and the install lock.
$wconvertImages = $wconvertUploads['basedir'] . '/wconvert-template-images';
if (!is_link($wconvertImages)) {
    foreach (['free', 'premium'] as $wconvertScope) {
        $wconvertRemoveOwned($wconvertImages . '/' . $wconvertScope, '/^[a-f0-9]{64}\.(?:png|jpg|webp)$/D');
    }
    $wconvertRemoveOwned($wconvertImages . '/sets', '/^(?:[a-f0-9]{64}\.json|\.set-[A-Za-z0-9]+)$/D');
    $wconvertRemoveOwned($wconvertImages, '/^(?:\.install\.lock|\.image-[A-Za-z0-9]+)$/D');
}

// Rest\TemplateTransferController — the private import folder in the temp
// directory, named by TemplateTransferController::folder(). One folder per
// administrator, and tempnam() files from exports and image staging.
$wconvertTransfer = rtrim(get_temp_dir(), '/') . '/wconvert-transfer-' . substr(hash('sha256', ABSPATH . wp_salt('auth')), 0, 24);
if (is_dir($wconvertTransfer) && !is_link($wconvertTransfer)) {
    foreach (scandir($wconvertTransfer) ?: [] as $wconvertSession) {
        if (preg_match('/^[a-f0-9]{64}$/D', $wconvertSession) === 1) {
            $wconvertRemoveOwned($wconvertTransfer . '/' . $wconvertSession, '/^(?:lock|session\.json|session\.tmp|upload\.zip|upload\.tmp)$/D');
        }
    }
    $wconvertRemoveOwned($wconvertTransfer, '/^(?:export|image)-[A-Za-z0-9]+$/D');
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
 * available since WordPress 6.2. `Connection` itself is not used:
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
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.NotPrepared -- dropping a table is not expressible any other way, and the identifier is bound as %i.
    $wpdb->query($wpdb->prepare('DROP TABLE IF EXISTS %i', $wpdb->prefix . $wconvertTable));
}

/*
 * WHAT IS DELIBERATELY NOT HERE.
 *
 * - **The other sites of a multisite network.** Multisite is out of scope for
 *   v1 and WConvert is meant to be activated per site, so this cleans the site
 *   it was asked about — the same scope its activation, its options and its
 *   tables all have (`Bootstrap::activate()`).
 */

// Owned, non-autoloaded capture receipts and anonymous flow labels. A static
// statement with nothing to bind, so nothing to prepare; and not cached,
// because it runs once, on the way out.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- see above.
$wconvertDynamicOptions = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wconvert\_capture\_%' OR option_name LIKE 'wconvert\_flow\_%' OR option_name LIKE 'wconvert\_mail\_%' OR option_name LIKE 'wconvert\_product\_tracking\_%'");
foreach ($wconvertDynamicOptions as $wconvertOption) {
    if (preg_match('/^wconvert_((?:capture|mail)_[a-f0-9]{64}|flow_[A-Z0-9]{26}_[a-f0-9]{64}|product_tracking_[A-Z0-9]{26})$/D', $wconvertOption)) delete_option($wconvertOption);
}
delete_option('wconvert_submission_checkpoint');

/*
 * Every scheduled job.
 *
 * WP-Cron events by hook, whatever their arguments — the import cleanup is
 * scheduled once per administrator, with that administrator as its argument,
 * so clearing it by hook and no arguments would miss every one. The pruner
 * and the recovery sweep are cleared on deactivation already, which WordPress
 * runs first; they are named again so that a plugin deleted without being
 * deactivated (WP-CLI's `--deactivate` is optional) leaves nothing behind.
 */
foreach (['wconvert_prune_leads', 'wconvert_recover_submissions', 'wconvert_transfer_cleanup'] as $wconvertHook) {
    wp_unschedule_hook($wconvertHook);
}

// Action Scheduler jobs, by WConvert's group (Queue\ActionSchedulerQueue::GROUP)
// and never by table: the tables are shared with every other plugin that
// bundles it. The plugin is not loaded here, so the library is loaded from its
// own folder when no other plugin has; it initialises itself late.
$wconvertScheduler = __DIR__ . '/vendor/woocommerce/action-scheduler/action-scheduler.php';
if (!class_exists('ActionScheduler', false) && is_file($wconvertScheduler)) {
    require_once $wconvertScheduler;
}
if (class_exists('ActionScheduler', false) && ActionScheduler::is_initialized() && function_exists('as_unschedule_all_actions')) {
    as_unschedule_all_actions('', [], 'wconvert');
}
// The running copy has hooked its queue runner onto `shutdown`. If that copy
// is WConvert's own — loaded here, or chosen from among every bundled copy
// earlier in this request — WordPress deletes the folder it autoloads from
// before `shutdown`, and the runner fatals on a class it can no longer find.
// Unhook it for this request. Another plugin's copy is left alone.
if (class_exists('ActionScheduler_QueueRunner', false)
    && str_starts_with((string) (new ReflectionClass('ActionScheduler_QueueRunner'))->getFileName(), __DIR__ . DIRECTORY_SEPARATOR)) {
    ActionScheduler_QueueRunner::instance()->unhook_dispatch_async_request();
}

// User metadata is blog-scoped because WordPress users span multisite blogs.
delete_metadata('user', 0, 'wconvert_picker_preferences_' . get_current_blog_id(), '', true);

// Short-lived picker write leases belong only to this site's options table.
// Static, like the statement above.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- see above.
$wconvertPickerLocks = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wconvert\_picker\_lock\_%'");
foreach ($wconvertPickerLocks as $wconvertPickerLock) {
    if (preg_match('/^wconvert_picker_lock_(?:occasions|user_[0-9]+)$/D', $wconvertPickerLock)) delete_option($wconvertPickerLock);
}

wp_clear_scheduled_hook('wconvert_product_stats_prune');

// Every WConvert transient: the rate-limit records (hashed addresses, minutes
// long) and the destination field and schema caches. They would expire on
// their own, but a deleted plugin should not leave a row behind for the next
// visit to find. Listed from the options table, then deleted through
// WordPress so an object cache drops its copy too. Static, like the
// statements above.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- see above.
$wconvertTransients = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_wconvert\_%'");
foreach ($wconvertTransients as $wconvertTransient) {
    delete_transient(substr($wconvertTransient, strlen('_transient_')));
}
