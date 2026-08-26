<?php

namespace WConvert\Destination;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * The last ~200 **terminal** delivery failures — a bounded ring, in its own
 * non-autoloaded option.
 *
 * This is the stated cost of {@see DestinationHealth}, paid rather than
 * hidden. A [[Lead]] that fails for a Lead-SPECIFIC terminal reason — a
 * malformed address, a compliance rejection — is invisible to health, because
 * it is not an outage. Without this ring there would be nothing anywhere
 * naming the Lead that never landed (ADR 0008).
 *
 * **Terminal means retries exhausted, or `retryable = false`.** A failure
 * still on its way round the queue is not here, because it has not failed yet.
 *
 * It degrades correctly: during a real outage it fills with redundant entries
 * while health already tells the story, and the entries roll off. That is the
 * intended behaviour of a ring and not a defect of it.
 *
 * **An entry holds a Lead id and an error string — never Lead data.** Same
 * rule as the queue's arguments, for the same reason: this option outlives the
 * retention policy WConvert sets for its own Leads, so personal data in it
 * would be personal data with no expiry.
 *
 * @since 0.1.0
 */
final class DeliveryFailures
{
    public const OPTION = 'wconvert_delivery_failures';

    /**
     * Roughly two hundred, and the roughness is honest: it is a debugging aid
     * sized to be readable on one screen and bounded so an option cannot grow
     * without limit. No decision reads the number.
     */
    public const KEPT = 200;

    /** Enough of a vendor's complaint to act on, and not enough to be a log file. */
    private const ERROR_LENGTH = 500;

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    /**
     * Newest first, which is the order a merchant reads them in.
     *
     * @return list<array{destination: string, lead: string, error: string, at: string}>
     */
    public function all(): array
    {
        $stored = $this->options->get(self::OPTION, []);
        $entries = [];

        foreach (is_array($stored) ? $stored : [] as $entry) {
            if (is_array($entry)) {
                $entries[] = [
                    'destination' => (string) ($entry['destination'] ?? ''),
                    'lead' => (string) ($entry['lead'] ?? ''),
                    'error' => (string) ($entry['error'] ?? ''),
                    'at' => (string) ($entry['at'] ?? ''),
                ];
            }
        }

        return $entries;
    }

    public function record(string $destinationId, string $leadId, string $error, string $at): void
    {
        $entries = $this->all();

        array_unshift($entries, [
            'destination' => $destinationId,
            'lead' => $leadId,
            'error' => mb_substr($error, 0, self::ERROR_LENGTH),
            'at' => $at,
        ]);

        $this->options->set(self::OPTION, array_slice($entries, 0, self::KEPT));
    }
}
