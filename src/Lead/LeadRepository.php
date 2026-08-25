<?php

namespace WConvert\Lead;

use WConvert\Database\Connection;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * Storage for [[Lead]]s.
 *
 * **There is one write, and it is an insert.** Not because nothing else has
 * been needed yet, but because nothing else may ever be: a Lead has no
 * lifecycle, so an update path here is the drift `wconvert_leads`' missing
 * `status` column exists to prevent (ADR 0002). {@see Connection} has no
 * `delete()` and no raw `query()` either, so the erasure #25 registers has to
 * widen that interface in a diff a reviewer sees.
 *
 * Reading is #25's, along with the grouping view identity is computed by.
 *
 * @since 0.1.0
 */
final class LeadRepository
{
    public function __construct(
        private readonly Connection $db,
    ) {
    }

    /**
     * Write one Lead, and hand it back as it landed.
     *
     * The id is a ULID like an Optin's: it is minted from a CSPRNG and sorts
     * chronologically, so `ORDER BY id` is `ORDER BY created_at` and the lead
     * log needs no index to list newest-first. `created_at` is a real column
     * regardless, because retention pruning is a range delete over it and
     * because it is the [[Consent Record]]'s timestamp — there is no second
     * one (ADR 0002, ADR 0032).
     */
    public function record(string $optinId, Capture $capture): Lead
    {
        $lead = new Lead(
            Ulid::generate(),
            $optinId,
            $capture->email,
            $capture->phone,
            $capture->fields,
            current_time('mysql')
        );

        $this->db->insert(Connection::TABLE_LEADS, [
            'id' => $lead->id,
            'optin_id' => $lead->optinId,
            'email' => $lead->email,
            'phone' => $lead->phone,
            'fields' => (string) wp_json_encode($lead->fields),
            'created_at' => $lead->createdAt,
        ]);

        return $lead;
    }
}
