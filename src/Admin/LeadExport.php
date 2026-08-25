<?php

namespace WConvert\Admin;

use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;

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
        return wp_nonce_url(admin_url('admin-post.php?action=' . self::ACTION), self::ACTION);
    }

    public function handle(): void
    {
        if (!current_user_can('manage_options') || !check_admin_referer(self::ACTION)) {
            wp_die(esc_html__('You are not allowed to export leads.', 'wconvert'), '', ['response' => 403]);
        }

        $optinId = isset($_GET['optin_id']) ? sanitize_text_field(wp_unslash((string) $_GET['optin_id'])) : '';

        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . self::filename() . '"');

        $handle = fopen('php://output', 'w');

        if ($handle !== false) {
            $this->stream($handle, $optinId === '' ? null : $optinId);
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
