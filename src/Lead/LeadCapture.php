<?php

namespace WConvert\Lead;

use WConvert\Support\DiagnosticSanitizer;

defined('ABSPATH') || exit;

/**
 * The capture path's ordering, in one place: **the local row first and always,
 * then everything else.**
 *
 * The local [[Lead]] log is not a [[Destination]] (ADR 0007). Test it against
 * every property the word carries — configured, optional, one of several, has
 * credentials, has a settings schema, can fail without the capture failing,
 * has delivery state — and it satisfies none of them. It is where a Lead is
 * STORED: written first, never queued, never retried, and if it fails the
 * capture failed.
 *
 * A Destination is the mirror image, and {@see self::CAPTURED} is where they
 * meet. Everything downstream — the WSMS push, the ESP pushes, the lead-magnet
 * delivery email — attaches to that hook and is queued through Action
 * Scheduler behind it (#30). None of it can reach a Lead that is not already
 * written, because the hook does not fire until it is.
 *
 * @since 0.1.0
 */
final class LeadCapture
{
    /**
     * Fires once a Lead is in the table.
     *
     * @param Lead $lead The Lead, as it landed.
     * @since 0.1.0
     */
    public const CAPTURED = 'wconvert_lead_captured';

    public function __construct(
        private readonly LeadRepository $leads,
    ) {
    }

    public function record(string $optinId, Submission $submission): Lead
    {
        $lead = $this->leads->record($optinId, $submission);

        // **A Destination can fail without the capture failing** (ADR 0007),
        // and the capture is already complete — so a handler that throws must
        // not turn a stored Lead into an error on the visitor's screen. It is
        // caught here rather than left to propagate. The merchant-facing record
        // of a failed delivery is Destination health (ADR 0008); this is the
        // developer's, so it goes to the error log only under WP_DEBUG.
        try {
            // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.DynamicHooknameFound -- self::CAPTURED is 'wconvert_'-prefixed.
            do_action(self::CAPTURED, $lead);
        } catch (\Throwable $failure) {
            if (!defined('WP_DEBUG') || !WP_DEBUG) {
                return $lead;
            }
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- under WP_DEBUG only, with personal data redacted.
            error_log(sprintf(
                'WConvert: a handler of %s threw for Lead %s. The Lead is stored; the dispatch is not. %s',
                self::CAPTURED,
                $lead->id,
                DiagnosticSanitizer::message($failure->getMessage(), [
                    $lead->email,
                    $lead->phone,
                    $lead->fields,
                ])
            ));
        }

        return $lead;
    }
}
