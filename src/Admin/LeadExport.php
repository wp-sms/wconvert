<?php

namespace WConvert\Admin;

use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * The CSV download.
 *
 * **An `admin-post.php` action rather than a REST route**, because a download
 * is a navigation and not a fetch: the browser has to be handed
 * `Content-Disposition`, and `apiFetch` reads a body it would then have to
 * turn back into a file. This is the WordPress shape for the job, and it is
 * where a nonce actually works — an authenticated admin click, unlike the
 * capture endpoint whose payload a full-page cache serves to everyone
 * (ADR 0004).
 *
 * **Streamed, never assembled.** The export walks the whole [[Lead]] log in
 * keyset batches and writes each one straight to the output stream, so the
 * memory it holds is one batch however many Leads there are — the read ADR
 * 0001 measured exhausting PHP's memory limit at a few hundred rows.
 *
 * @since 0.1.0
 */
final class LeadExport
{
    /** @since 0.1.0 */
    public const ACTION = 'wconvert_export_leads';

    /** Leads per round trip. Large enough to be few queries, small enough to be bounded memory. */
    private const BATCH = 500;

    public function __construct(
        private readonly LeadRepository $leads,
        private readonly OptinRepository $optins,
        private readonly LeadCsv $csv,
    ) {
    }

    public function hooks(): void
    {
        add_action('admin_post_' . self::ACTION, [$this, 'handle']);
    }

    /**
     * The URL the admin screen links to, nonce and all.
     *
     * It carries no `optin_id`, and the screen appends one when the log is
     * filtered. That is safe because the nonce is bound to the ACTION rather
     * than to the query string — and it is why the export needs one URL rather
     * than one per Optin.
     */
    public static function url(): string
    {
        // Composed rather than `wp_nonce_url()`, which is the same URL run
        // through `esc_html()`. This one is handed to JavaScript as DATA — the
        // screen appends `optin_id` to it — so an HTML-encoded `&amp;` between
        // the parameters is not an escape but a corruption: the browser would
        // send `amp;optin_id` and the export would ignore the filter.
        return add_query_arg('_wpnonce', wp_create_nonce(self::ACTION), admin_url('admin-post.php?action=' . self::ACTION));
    }

    public function handle(): void
    {
        if (!current_user_can('manage_options') || !check_admin_referer(self::ACTION)) {
            wp_die(esc_html__('You are not allowed to export leads.', 'wconvert'), '', ['response' => 403]);
        }

        $optinId = isset($_GET['optin_id']) ? sanitize_text_field(wp_unslash((string) $_GET['optin_id'])) : '';

        // Checked against the shape rather than merely sanitised. The value
        // goes into a prepared statement either way, so this is not about
        // injection — it is that a filter which is not an id matches no rows,
        // and a merchant would download an empty file believing they had
        // exported an Optin. The REST log route holds the same line at its
        // `optin_id` argument.
        if ($optinId !== '' && !Ulid::isOne($optinId)) {
            wp_die(esc_html__('That is not an Optin.', 'wconvert'), '', ['response' => 400]);
        }

        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . self::filename() . '"');

        // `php://output` is the RESPONSE, not a file, which is the whole
        // point: the log can be large and the export streams it in keyset
        // batches, so nothing holds the whole CSV in memory. WP_Filesystem is
        // an abstraction over files on disk and cannot open this stream at
        // all — the alternative it implies is buffering the export and
        // writing it somewhere, which is the failure mode this shape exists
        // to avoid.
        //
        // WPCS agrees about the OPEN and only about the open: its
        // AlternativeFunctions sniff exempts fopen(), file_put_contents() and
        // readfile() when the filename is a local data stream, and
        // `php://output` is on that list. fclose() takes a handle rather than
        // a filename, so the sniff has nothing to inspect and flags every
        // call — including the one closing a handle it just exempted.
        $handle = fopen('php://output', 'w');

        if ($handle !== false) {
            $this->stream($handle, $optinId === '' ? null : $optinId);
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- closes the php://output handle opened above, which the same sniff exempts.
            fclose($handle);
        }

        exit;
    }

    /**
     * Write the whole log to a stream, in batches.
     *
     * @param resource $handle
     */
    public function stream($handle, ?string $optinId): void
    {
        // Read once, before the walk. Every batch labels its Leads from this,
        // and it includes soft-deleted Optins because their names are exactly
        // what the export has to carry (ADR 0002, ADR 0020).
        $names = $this->optins->names();

        $this->csv->writeHeader($handle);

        // The empty string sorts below every ULID, so the first batch starts at
        // the beginning without a branch for it.
        $cursor = '';

        while (true) {
            $batch = $this->leads->since($optinId, $cursor, self::BATCH);

            if ($batch === []) {
                return;
            }

            $this->csv->writeRows($handle, $batch, $names);

            $cursor = $batch[count($batch) - 1]->id;
        }
    }

    /**
     * A filename carrying the day it was taken.
     *
     * Deliberately not the Optin's name: it is user-supplied text on its way
     * into a `Content-Disposition` header, and a date needs no escaping to be
     * safe. The Optin's name is in the file, on every row (ADR 0018).
     */
    private static function filename(): string
    {
        return 'wconvert-leads-' . gmdate('Y-m-d') . '.csv';
    }
}
