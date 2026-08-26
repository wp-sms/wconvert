<?php

namespace WConvert\Optin;

use WConvert\Database\Connection;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * Storage for Optins, and the one place the published set is rebuilt.
 *
 * **`publish()`, `unpublish()` and `delete()` each rebuild the set in the same
 * call that writes the row.** That is not a convenience — it is what makes
 * "rebuilt on write, never on read" (ADR 0003) a property of the code rather
 * than of everyone's memory. There is no promote-without-rebuild path to
 * forget to pair with one.
 *
 * Every read is a PROJECTION. `SELECT *` drags two LONGTEXT columns per row,
 * which WSMS measured exhausting PHP's memory limit at a few hundred rows
 * (ADR 0001), so the columns are named at every call site.
 *
 * @since 0.1.0
 */
final class OptinRepository
{
    /** Every column of an Optin, for the one read that legitimately wants them all. */
    private const FULL_COLUMNS = 'id, name, goal, config, published_config, published_at, deleted_at';

    /** The list view's projection — no LONGTEXT. */
    private const SUMMARY_COLUMNS = 'id, name, goal, published_at, deleted_at';

    /** What the published set is built from. */
    private const PROJECTION_COLUMNS = 'id, published_config, published_at, deleted_at';

    /** Enough to label a [[Lead]] with the Optin that captured it, and nothing more. */
    private const NAME_COLUMNS = 'id, name';

    /** Everything needed to interpret a count, and nothing else (ADR 0020). */
    private const INTERPRETATION_COLUMNS = 'id, name, goal, deleted_at';

    /** Which [[Destination]]s an Optin binds — the published config, and the id to key it by. */
    private const BINDING_COLUMNS = 'id, published_config';

    public function __construct(
        private readonly Connection $db,
        private readonly PublishedSet $publishedSet,
        private readonly RuleVocabulary $vocabulary,
    ) {
    }

    /**
     * @param array<string, mixed> $config
     */
    public function create(string $name, string $goal, array $config): Optin
    {
        $id = Ulid::generate();

        // A new Optin is a draft. `published_config` and `published_at` stay
        // null until someone publishes it, which is the whole reason they are
        // separate columns from `config`.
        $this->db->insert(Connection::TABLE_OPTINS, [
            'id' => $id,
            'name' => $name,
            'goal' => $goal,
            'config' => (string) wp_json_encode($config),
            'published_config' => null,
            'published_at' => null,
            'deleted_at' => null,
        ]);

        return new Optin($id, $name, $goal, $config);
    }

    /**
     * Edit the working draft. Deliberately does NOT rebuild the published set:
     * nothing it can change is in the set until someone publishes.
     *
     * @param array<string, mixed>|null $config
     */
    public function saveDraft(string $id, ?string $name, ?string $goal, ?array $config): ?Optin
    {
        if ($this->find($id) === null) {
            return null;
        }

        $data = array_filter(
            [
                'name' => $name,
                'goal' => $goal,
                'config' => $config === null ? null : (string) wp_json_encode($config),
            ],
            static fn ($value): bool => $value !== null
        );

        if ($data !== []) {
            $this->db->update(Connection::TABLE_OPTINS, $data, ['id' => $id]);
        }

        return $this->find($id);
    }

    public function find(string $id): ?Optin
    {
        $row = $this->db->row(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE id = %s',
            $id
        );

        return $row === null ? null : Optin::fromRow($row);
    }

    /**
     * The list view. Newest first — the id is a ULID, so ordering by it is
     * ordering by the moment it was created, with no column to keep in step.
     *
     * @return list<array<string, string|null>>
     */
    public function summaries(bool $includeDeleted = false): array
    {
        $where = $includeDeleted ? '1=1' : 'deleted_at IS NULL';

        return $this->db->results(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::SUMMARY_COLUMNS . ' FROM %i WHERE ' . $where . ' ORDER BY id DESC LIMIT 500'
        );
    }

    /**
     * Every Optin's name, by id — **soft-deleted ones included**.
     *
     * This is what the [[Lead]] log, the CSV export and the personal-data
     * export all label a Lead with, and it is the reason deleting an Optin is
     * a `deleted_at` stamp rather than a row removal: the name has to survive
     * for exactly this, without being denormalised onto every Lead row
     * (ADR 0002, ADR 0020). Excluding deleted Optins here would blank the
     * label precisely for the Leads whose provenance is hardest to recover.
     *
     * Two short columns and no `LIMIT`. A cap would silently blank names past
     * it, which is worse than the read it would save on an install that has
     * more Optins than any install has.
     *
     * @return array<string, string>
     */
    public function names(): array
    {
        $names = [];

        foreach ($this->db->results(Connection::TABLE_OPTINS, 'SELECT ' . self::NAME_COLUMNS . ' FROM %i') as $row) {
            $names[(string) $row['id']] = (string) ($row['name'] ?? '');
        }

        return $names;
    }

    /**
     * **Everything needed to interpret a count** — and every Optin, including
     * the soft-deleted ones.
     *
     * ========================================================================
     * THIS IS THE HALF OF THE ANALYTICS JOIN THAT IS NOT THE COUNTERS.
     * ========================================================================
     * A row in `wconvert_stats` carries no `goal`, no `had_email` and no
     * display type; everything that says what a count MEANS is read from this
     * table at report time (ADR 0020). So the Goal here is the Optin's
     * CURRENT one, which is exactly what makes correcting a mis-set Goal
     * restate its whole history rather than split it at the moment of the
     * edit.
     *
     * **Soft-deleted Optins are included, and that is the point.** Their
     * counts stay in their Goal's totals — a merchant tidying up in March must
     * not watch February's goal total fall — and it is {@see \WConvert\Stats\Dashboard} that
     * drops their ROW from the per-Optin list. Excluding them here would take
     * the counts away with the row, which is the one direction that cannot be
     * undone. It is the same reason {@see self::names()} includes them, one
     * table over.
     *
     * **Four short columns and no `LIMIT`.** {@see self::summaries()} caps at
     * 500 because a list view past that is a scrolling problem; a cap HERE
     * would silently drop the 501st Optin's counts out of its Goal's total,
     * which is a wrong number rather than a short page. The same argument
     * `names()` makes, and it is worth more here: nobody can see that a total
     * is missing something.
     *
     * @return list<array<string, string|null>>
     */
    public function interpretations(): array
    {
        return $this->db->results(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::INTERPRETATION_COLUMNS . ' FROM %i'
        );
    }

    /**
     * Every Optin's published config, by id — **soft-deleted and unpublished
     * ones included.**
     *
     * The one caller is bulk re-push, which asks which Optins are bound to a
     * [[Destination]] ({@see \WConvert\Destination\OptinBinding}). A [[Lead]]
     * captured last week by an Optin since unpublished still needs re-pushing,
     * and unpublishing keeps the last live config precisely so republishing is
     * not a retype — so filtering here would silently drop exactly the Leads
     * an operator is trying to recover.
     *
     * It is the one read outside the published-set rebuild that pulls a
     * LONGTEXT column for every row, and it is affordable because it happens
     * when a human presses a button rather than on any request path.
     *
     * @return array<string, array<string, mixed>|null>
     */
    public function publishedConfigs(): array
    {
        $configs = [];

        foreach ($this->db->results(Connection::TABLE_OPTINS, 'SELECT ' . self::BINDING_COLUMNS . ' FROM %i') as $row) {
            $decoded = json_decode((string) ($row['published_config'] ?? ''), true);

            $configs[(string) $row['id']] = is_array($decoded) ? $decoded : null;
        }

        return $configs;
    }

    /**
     * Promote the working draft onto the live one, and rebuild the set.
     */
    public function publish(string $id): ?Optin
    {
        $optin = $this->find($id);

        // A deleted Optin cannot be published back into existence. Undeleting
        // is its own act, and this is not it.
        if ($optin === null || $optin->isDeleted()) {
            return null;
        }

        $this->db->update(Connection::TABLE_OPTINS, [
            'published_config' => (string) wp_json_encode($optin->config),
            'published_at' => current_time('mysql'),
        ], ['id' => $id]);

        $this->rebuildPublishedSet();

        return $this->find($id);
    }

    /**
     * Take it off the site, and rebuild the set.
     *
     * `published_config` is left in place on purpose: it is the last version
     * the site actually served, so republishing is one click and not a retype.
     * `published_at` is the marker the projection reads.
     */
    public function unpublish(string $id): ?Optin
    {
        if ($this->find($id) === null) {
            return null;
        }

        $this->db->update(Connection::TABLE_OPTINS, ['published_at' => null], ['id' => $id]);

        $this->rebuildPublishedSet();

        return $this->find($id);
    }

    /**
     * Soft-delete, and rebuild the set.
     *
     * There is no hard delete and there is no path to one: {@see Connection}
     * has no `delete()` to call. An Optin's conversion counts are interpreted
     * by joining this table at report time, so removing the row makes every
     * count that references it uninterpretable (ADR 0002, ADR 0020).
     */
    public function delete(string $id): bool
    {
        if ($this->find($id) === null) {
            return false;
        }

        $this->db->update(Connection::TABLE_OPTINS, ['deleted_at' => current_time('mysql')], ['id' => $id]);

        $this->rebuildPublishedSet();

        return true;
    }

    /**
     * Rebuild the published set from the table.
     *
     * Private: every caller that should reach it is in this class, and a
     * public rebuild is an invitation to call it on read.
     */
    private function rebuildPublishedSet(): void
    {
        $rows = $this->db->results(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::PROJECTION_COLUMNS
                . ' FROM %i WHERE published_at IS NOT NULL AND deleted_at IS NULL ORDER BY id ASC'
        );

        // The WHERE clause and PublishedProjection's exclusion set say the same
        // thing, and that is deliberate: the SQL keeps the rebuild from
        // dragging every soft-deleted row through PHP, and the projection is
        // where the rule is stated and tested. A row that slips past the query
        // is still excluded.
        $this->publishedSet->replaceWith(PublishedProjection::build($rows, $this->vocabulary));
    }
}
