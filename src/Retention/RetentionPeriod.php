<?php

namespace WConvert\Retention;

use WConvert\Storage\OptionStore;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * How long a merchant keeps their [[Lead]]s.
 *
 * **It ships as keep-forever, and pruning is off** (ADR 0018). Deleting a
 * merchant's Leads because the plugin shipped an opinion is a support
 * catastrophe, and may destroy records they are required to keep for reasons
 * that have nothing to do with marketing. {@see LeadPruner} exists from day
 * one regardless and simply has nothing to do until a period is set.
 *
 * **Storage is one WordPress option, not a column.** It is a single integer
 * for the whole site, read once a day by a cron job and once per render by a
 * settings screen — which is the table-free alternative the database rule asks
 * to have considered, and the right one. Not autoloaded, like everything else
 * WConvert stores (ADR 0003).
 *
 * @since 0.1.0
 */
final class RetentionPeriod
{
    public const OPTION = 'wconvert_retention_days';

    /**
     * Ten years, past which a period is keep-forever with extra steps.
     *
     * The cap is not arithmetic hygiene: an unbounded number here is a
     * boundary far enough in the past to be a ULID that sorts below every row,
     * which is a prune of the whole table wearing a setting's clothes.
     */
    public const MAX_DAYS = 3650;

    private const DAY_IN_MS = 86400000;

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    /**
     * The configured period in days, or **null for keep-forever**.
     *
     * Zero and negative are keep-forever too, and deliberately not "delete
     * everything older than now": a merchant who clears the field is turning
     * retention off, and the reading that empties their log on the next cron
     * run is the one this must never take.
     */
    public function days(): ?int
    {
        $stored = (int) $this->options->get(self::OPTION, 0);

        return $stored <= 0 ? null : min($stored, self::MAX_DAYS);
    }

    public function set(?int $days): void
    {
        $this->options->set(self::OPTION, $days === null || $days <= 0 ? 0 : min($days, self::MAX_DAYS));
    }

    /**
     * The id below which every [[Lead]] has outlived the period — or null
     * where there is no period and therefore nothing to prune.
     *
     * A ULID rather than a datetime, so the range the pruner opens is one over
     * the PRIMARY KEY. The two name the same rows: a ULID's leading 48 bits
     * are the minting time, stamped in the same statement as `created_at`.
     * Only the primary key is an index `wconvert_leads` already has
     * (ADR 0002, ADR 0018).
     */
    public function boundary(int $nowInMilliseconds): ?string
    {
        $days = $this->days();

        return $days === null ? null : Ulid::floorAt($nowInMilliseconds - ($days * self::DAY_IN_MS));
    }
}
