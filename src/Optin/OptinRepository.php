<?php

namespace WConvert\Optin;

use WConvert\Database\Connection;
use WConvert\Goal\Goal;
use WConvert\Milestone\MilestoneStore;
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
 * **{@see self::publish()} stamps the activation milestone in that same call,
 * and it is here for exactly that reason.** "The plugin is active and an
 * Optin has been published" is the first of #94's five, and this method is the
 * definition of the event — so a milestone written from the REST controller
 * instead would be one that a WP-CLI command or a bulk action silently misses.
 * The guard against writing it twice lives in {@see MilestoneStore}, not here.
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
    private const FULL_COLUMNS = 'id, name, goal, parent_id, config, published_config, published_at, deleted_at';

    /**
     * The list view's projection — no LONGTEXT returned to PHP.
     *
     * The database compares the existing snapshots and returns one boolean.
     * BINARY matters: a case-only copy edit must not disappear under the site's
     * case-insensitive collation. Drafts and deleted rows have no live update.
     *
     * **`parent_id` is here, and it is the reason it is a column at all.**
     * ADR 0045 says the Optins list shows parentless Optins only and nests
     * each test's arms beneath their parent; both halves of that are questions
     * about a row this query can see. Held in `config` the way that ADR first
     * proposed, neither could be asked without putting a LONGTEXT blob back
     * into this list — which is the read ADR 0001 measured exhausting PHP's
     * memory at a few hundred rows, and the whole reason this constant exists.
     */
    private const SUMMARY_COLUMNS = 'id, name, goal, parent_id, published_at, deleted_at, '
        . '(published_at IS NOT NULL AND deleted_at IS NULL AND NOT (BINARY config <=> BINARY published_config)) AS has_unpublished_changes';

    /**
     * What the published set is built from.
     *
     * **`goal` is here and `name` is not**, which is the line: the set is the
     * front end's read path, so a column earns its place by being something
     * the page needs. The Goal is what says an Optin's CTA goes back to the
     * cart, and the cart URL is resolved per request from `wc_get_cart_url()`
     * rather than frozen into the set (ADR 0025) — so the Goal has to reach
     * enqueue. It is an indexed `VARCHAR(64)` beside a `LONGTEXT` this query
     * already pulls, and it never reaches the browser
     * ({@see \WConvert\Optin\PublishedProjection}).
     *
     * ========================================================================
     * AND `parent_id` IS HERE, WHICH IT WAS NOT WHEN THE COLUMN WAS ADDED.
     * ========================================================================
     * The pre-release audit put `parent_id` in {@see self::SUMMARY_COLUMNS}
     * for the LIST and stopped there. That was right for what it was building
     * and it left the front end unable to express a test at all: two published
     * arms reached the browser as two independent entries, and `decide.ts`'s
     * `arbitrate()` reads two overlays as two campaigns competing for one
     * screen rather than as one choice between two designs (ADR 0045).
     *
     * So the published set is where the link has to arrive, and this is the
     * column that carries it there. **It never reaches the browser as
     * itself**: {@see PublishedProjection} turns it into
     * `[experiment, arm, arms]`, which is a fact about the whole SET and
     * cannot be derived from one row — and it is computed at the rebuild
     * below rather than per request, because ADR 0003 rebuilds the set on
     * write and never on read.
     */
    private const PROJECTION_COLUMNS = 'id, goal, parent_id, published_config, published_at, deleted_at';

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
        private readonly MilestoneStore $milestones,
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
            // Every Optin created through this method is a campaign in its own
            // right. {@see self::createVariant()} is the one thing that writes
            // a parent (ADR 0045) — spelled as an explicit null here for the
            // reason the two publish columns below are, so the insert names
            // the whole row.
            'parent_id' => null,
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
     * ========================================================================
     * PARENTLESS ONLY. THIS IS THE UI HALF OF ADR 0045, AND IT IS A `WHERE`.
     * ========================================================================
     * A [[Variant]] is a whole Optin with its own row and its own counters, so
     * a merchant running three A/B tests would meet six campaigns in a list of
     * campaigns. They do not: a test is **one** row here, and the ticket that
     * builds A/B draws each parent's arms beneath it from its own read. That
     * is a query condition rather than a schema decision — storage does not
     * constrain the screen — but it needs a column to be a query condition at
     * all, which is why `parent_id` is one.
     *
     * It filters today over a table where every `parent_id` is `NULL`, and
     * that is the point rather than a defect: it is written before anything
     * writes a parent, so no existing row has to be found and repaired later.
     *
     * The `LIMIT` is unchanged and still 500. A list view past that is a
     * scrolling problem rather than a correctness one — unlike
     * {@see self::names()} and {@see self::interpretations()}, where a cap
     * would silently produce a wrong number.
     *
     * @return list<array<string, string|null>>
     */
    public function summaries(bool $includeDeleted = false): array
    {
        $where = $includeDeleted ? 'parent_id IS NULL' : 'parent_id IS NULL AND deleted_at IS NULL';

        return $this->db->results(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::SUMMARY_COLUMNS . ' FROM %i WHERE ' . $where . ' ORDER BY id DESC LIMIT 500'
        );
    }

    /**
     * The arms of every test, grouped by the parent they hang beneath.
     *
     * ========================================================================
     * THE OTHER HALF OF ADR 0045'S LIST, AND IT IS ONE QUERY RATHER THAN 500.
     * ========================================================================
     * {@see self::summaries()} filters to parentless Optins, which is the
     * filter the audit built ahead of the feature. This is the read that draws
     * each parent's arms beneath it — so a merchant running three tests meets
     * three campaigns with arms under them rather than six campaigns.
     *
     * **Every child in one statement, grouped in PHP.** A per-parent query
     * would be up to 500 round trips to draw one screen, and the join is the
     * same one {@see \WConvert\Stats\Dashboard} performs: two reads and the
     * grouping in PHP, because a `JOIN` here would drag the parent's columns
     * onto every child row to save an array walk (ADR 0034).
     *
     * **Ascending by id**, which is ascending by the moment each arm was
     * created, so the arms read A, B, C down the screen in the order the
     * merchant made them. That is the opposite of `summaries()`'s `DESC` and
     * deliberately so: a LIST is newest-first because the thing you just made
     * is the thing you want; a test's arms are a sequence, and reversing a
     * sequence makes B the first thing read.
     *
     * **And no `LIMIT`, unlike {@see self::summaries()}.** That cap is right
     * there because a list view past 500 is a scrolling problem; a cap HERE
     * would drop an arm out of a test that still has it, so the screen would
     * show a two-arm test as a one-arm one and a merchant would compare a
     * number against nothing. That is a wrong screen rather than a short page,
     * which is the same reason {@see self::names()} and
     * {@see self::interpretations()} have none — and these are the same short
     * columns, on rows that exist only while somebody is running a test.
     *
     * @return array<string, list<array<string, string|null>>> Parent id => its arms.
     */
    public function armsByParent(bool $includeDeleted = false): array
    {
        $rows = $this->db->results(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::SUMMARY_COLUMNS . ' FROM %i WHERE parent_id IS NOT NULL ORDER BY id ASC'
        );

        $arms = [];

        foreach ($rows as $row) {
            $parent = (string) ($row['parent_id'] ?? '');

            // **The soft-delete filter is in PHP and the parent filter is in
            // SQL**, which is the split every other read here makes for the
            // same reason: `parent_id IS NOT NULL` is what keeps 500 campaigns
            // off this query, and a second `WHERE` would only save walking the
            // arms of tests that have ended — a handful of short rows, against
            // a predicate that then has to be true in two languages for
            // {@see self::declareWinner()} and {@see self::countArms()} to
            // agree about what an arm is.
            if ($parent === '' || (!$includeDeleted && ($row['deleted_at'] ?? null) !== null)) {
                continue;
            }

            $arms[$parent][] = $row;
        }

        return $arms;
    }

    /**
     * Every OTHER Optin in this one's test — its parent and the other arms.
     *
     * ========================================================================
     * THE READ THE COMPARABILITY REFUSAL NEEDS, AND THE ONLY ONE HERE THAT
     * PULLS `config` FOR MORE THAN ONE ROW.
     * ========================================================================
     * An arm's design has to convert the same way as its siblings', or the
     * test compares a submission rate against a click rate (ADR 0059). That
     * question can only be asked of the siblings' own designs, and a design
     * lives in `config` — so this is a LONGTEXT read, deliberately, on a path
     * that runs once per save of an Optin that is part of a test.
     *
     * **It is bounded by what a test is.** A family is a parent and its arms —
     * two rows in every test anybody runs, a handful at the outside — never
     * the 500 the list is capped at. There is no `LIMIT` for
     * {@see self::armsByParent()}'s reason: a cap here would silently drop an
     * arm out of the comparison and let exactly the mismatch this exists to
     * catch through.
     *
     * **The parent is arm A**, so it is in the family rather than above it:
     * an arm compared only against its siblings and not against the campaign
     * it hangs beneath would be comparable to half the test.
     *
     * Soft-deleted rows are excluded. An arm the merchant ended is a month of
     * history rather than a running comparison (CONTEXT.md, Variant), and
     * refusing an edit because of one would be refusing on the strength of a
     * row nothing reads any more.
     *
     * @return list<Optin>
     */
    public function otherArmsOf(string $id): array
    {
        $optin = $this->find($id);

        if ($optin === null) {
            return [];
        }

        $root = $optin->parentId ?? $optin->id;

        $rows = $this->db->results(
            Connection::TABLE_OPTINS,
            'SELECT ' . self::FULL_COLUMNS . ' FROM %i'
            . ' WHERE (id = %s OR parent_id = %s) ORDER BY id ASC',
            $root,
            $root
        );

        $family = [];

        foreach ($rows as $row) {
            $arm = Optin::fromRow($row);

            // **Read back in PHP as well as asked in SQL**, which is
            // {@see self::armsByParent()}'s own split arriving at the same
            // place: the predicate is what keeps 500 campaigns out of the
            // query, and re-asking it here is what makes "the other arms"
            // mean one thing rather than one thing per storage backend.
            if ($arm->id === $id || $arm->isDeleted() || ($arm->id !== $root && $arm->parentId !== $root)) {
                continue;
            }

            $family[] = $arm;
        }

        return $family;
    }

    /**
     * Start a test: a second [[Optin]] that is a copy of this one and names it
     * as its parent.
     *
     * ========================================================================
     * A VARIANT IS A WHOLE OPTIN, AND THIS IS THE ONLY THING THAT WRITES A
     * PARENT.
     * ========================================================================
     * {@see self::create()} spells `parent_id` as an explicit null and says
     * so; this is the method that comment was waiting for. Everything else
     * about the row is ordinary — its own ULID, its own `config`, and
     * therefore its own `(optin_id, stat_date, kind)` counters with no change
     * to `wconvert_stats` at all (ADR 0045).
     *
     * **It is not asked for a name.** Nobody should be asked to name a thing
     * they think of as *the other one*, so it takes its parent's with a
     * letter after it — the parent is arm A, the first variant is B. The
     * letter is counted over ALL of the parent's children including the
     * soft-deleted ones, so a merchant who ended one test and started another
     * never gets two rows called *"Welcome (B)"* — which would be two
     * different designs under one label in the [[Lead]] log, where the name is
     * the only provenance a Lead has (ADR 0002).
     *
     * **The DRAFT is copied and the published copy is not.** A variant starts
     * where its parent's editor starts and goes live when the merchant
     * publishes it, exactly as any other Optin does. Copying
     * `published_config` would put a second arm on the site the moment the
     * button was pressed, which is a test starting without anybody saying so.
     *
     * **A variant of a variant is refused.** Arms are a flat set under one
     * parent — the payload's `[experiment, arm, arms]` triple has one
     * experiment id in it, and a grandchild would name a parent that is
     * itself an arm of something else. There is no test that shape describes.
     *
     * Nothing is published, so the set is untouched and there is no rebuild:
     * this is the same reasoning {@see self::saveDraft()} states.
     */
    public function createVariant(string $parentId): ?Optin
    {
        $parent = $this->find($parentId);

        if ($parent === null || $parent->isDeleted() || $parent->parentId !== null) {
            return null;
        }

        $id = Ulid::generate();

        $this->db->insert(Connection::TABLE_OPTINS, [
            'id' => $id,
            'name' => self::nextArmName($parent->name, $this->countArms($parentId)),
            // The parent's Goal, and not a choice. One test compares two
            // designs of one campaign, and two arms filed under different
            // Goals would be read off two different cards — which is not one
            // test at all (ADR 0020, ADR 0045).
            //
            // **It used to carry the comparability guarantee too, and it no
            // longer can.** A shared Goal used to mean a shared converting
            // act, because the Goal declared one; the act is the design's now
            // (ADR 0059), so an arm is free to hold a design that converts
            // differently and a ~3% submission rate would be compared against
            // a ~25% click rate. That guarantee moved to an explicit refusal
            // at the write ({@see \WConvert\Rest\OptinController}), stated
            // where it is actually true rather than smuggled in here.
            //
            // A variant starts as a COPY of its parent's config, so it is born
            // comparable and only an edit can break it — which is the edit
            // that refusal catches.
            'goal' => $parent->goal,
            'parent_id' => $parentId,
            'config' => (string) wp_json_encode($parent->config),
            'published_config' => null,
            'published_at' => null,
            'deleted_at' => null,
        ]);

        return $this->find($id);
    }

    /**
     * End a test: this arm becomes the campaign, and every other arm is
     * tidied away.
     *
     * ========================================================================
     * IT NEVER DELETES A ROW, AND {@see Connection} HAS NO `delete()` TO CALL.
     * ========================================================================
     * The losing arm is a month of the merchant's own history. A removed row
     * makes every count naming it uninterpretable (ADR 0020), and "tidy up
     * the finished test" reads as housekeeping right up to the moment it
     * destroys the comparison the test was run to produce. The loser is
     * soft-deleted at most — at which point it behaves like any other tidied
     * Optin, keeping its counts in the per-[[Goal]] total and dropping out of
     * the per-Optin list, with no special case anywhere.
     *
     * ========================================================================
     * THE WINNER IS PROMOTED BY MOVING THE ROW, NOT BY COPYING THE DESIGN.
     * ========================================================================
     * ADR 0045 sketches this as *"promote the winner's design onto the
     * parent"*, and that is the one shape it must not be. Copying arm B's
     * design onto arm A's row leaves one row whose counters are arm A's
     * history followed by arm B's future, under a rate that is the average of
     * two different designs — the frozen-at-write blend ADR 0020 exists to
     * prevent, arriving through a config copy instead of through a column.
     *
     * So nothing is copied. The winning row **stops having a parent** and
     * takes the campaign's name, which is the same rule that named it in the
     * first place read backwards: a variant is never asked for a name because
     * it is the other one, and the one that wins is simply the campaign. Every
     * row's counters keep meaning exactly one design for the whole of its
     * life.
     *
     * There is **no `finished` flag and no new storage**, which is the point:
     * a test is running exactly while a parentless Optin has arms beneath it,
     * so ending one is the absence of the rows rather than the presence of a
     * marker. {@see PublishedProjection} reads it the same way and stops
     * writing the payload's arm triple on the rebuild this call performs.
     *
     * @param string $parentId The test — the parentless Optin the arms hang beneath.
     * @param string $winnerId The arm that won. The parent itself is a legitimate answer.
     */
    public function declareWinner(string $parentId, string $winnerId): bool
    {
        $parent = $this->find($parentId);

        if ($parent === null || $parent->isDeleted() || $parent->parentId !== null) {
            return false;
        }

        $arms = [$parent->id];

        foreach ($this->armsByParent()[$parentId] ?? [] as $arm) {
            $arms[] = (string) ($arm['id'] ?? '');
        }

        // A test needs two arms and a winner has to be one of them. Both are
        // refusals rather than no-ops: "declare a winner of a test that is not
        // running" and "declare a winner that is not in it" are mistakes a
        // caller should hear about, and silently doing nothing would soft-
        // delete nothing while answering as though it had.
        if (count($arms) < 2 || !in_array($winnerId, $arms, true)) {
            return false;
        }

        if ($winnerId !== $parent->id) {
            $this->db->update(
                Connection::TABLE_OPTINS,
                ['parent_id' => null, 'name' => $parent->name],
                ['id' => $winnerId]
            );
        }

        $now = current_time('mysql');

        foreach ($arms as $arm) {
            if ($arm === $winnerId) {
                continue;
            }

            // ================================================================
            // THE LOSERS HANG BENEATH THE WINNER, WHICH IS NOT TIDINESS.
            // ================================================================
            // The whole test's history follows the campaign that won, so
            // {@see self::countArms()} can still see every arm this test ever
            // had — and **a retired letter is never handed out twice.**
            //
            // Leaving them under the old parent breaks that the moment a
            // CHILD wins: the promoted row has no children of its own, so the
            // next variant of it is named `(B)` again, beside a soft-deleted
            // `(B)` that is a different design. Two rows under one name in the
            // [[Lead]] log is two designs under one label, where the name is
            // the only provenance a Lead has (ADR 0002, ADR 0020).
            //
            // It also keeps the shape honest to read: a finished test is one
            // parentless campaign with every arm it ever ran beneath it,
            // whichever arm won.
            $this->db->update(
                Connection::TABLE_OPTINS,
                ['deleted_at' => $now, 'parent_id' => $winnerId],
                ['id' => $arm]
            );
        }

        $this->rebuildPublishedSet();

        return true;
    }

    /**
     * How many arms this test has ever had, soft-deleted ones included.
     *
     * Counted rather than read off the live list because it names the NEXT
     * arm, and a letter is only unambiguous if a retired one is never handed
     * out twice ({@see self::createVariant()}).
     */
    private function countArms(string $parentId): int
    {
        return count($this->armsByParent(true)[$parentId] ?? []);
    }

    /**
     * The parent's name with this arm's letter after it.
     *
     * The parent is arm A and is never renamed, so the first variant is B.
     * Past Z it is a number rather than `AA`: twenty-six arms of one test is
     * not a thing anybody is doing, and a spreadsheet column name would read
     * as a mistake where *"Welcome (27)"* reads as a count.
     *
     * **Truncated to the column**, because `name` is `VARCHAR(255)` and a
     * parent already at the limit would otherwise have its suffix silently cut
     * off by MySQL — leaving a variant with exactly its parent's name, which
     * is the one name it must not have.
     */
    private static function nextArmName(string $parent, int $existingArms): string
    {
        $position = $existingArms + 1;
        $suffix = ' (' . ($position < 26 ? chr(ord('A') + $position) : (string) ($position + 1)) . ')';

        $room = 255 - strlen($suffix);
        $trimmed = strlen($parent) > $room ? rtrim((string) mb_strcut($parent, 0, $room)) : $parent;

        return $trimmed . $suffix;
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
     * One Optin's name.
     *
     * Beside {@see self::names()} rather than replacing it: the lead log and
     * the CSV export label thousands of rows and want the whole map, while a
     * queued push wants ONE name and would otherwise pull every Optin's name
     * off disk per job to read a single key.
     *
     * **Soft-deleted Optins included**, for the same reason `names()` includes
     * them: a [[Lead]] outlives the Optin that captured it, and the name is
     * exactly what the soft delete exists to preserve (ADR 0002, ADR 0020).
     */
    public function nameOf(string $id): ?string
    {
        $row = $this->db->row(Connection::TABLE_OPTINS, 'SELECT name FROM %i WHERE id = %s', $id);

        return $row === null ? null : (string) ($row['name'] ?? '');
    }

    /**
     * One Optin's [[Goal]].
     *
     * Beside {@see self::nameOf()} and for the same stated reason: a queued
     * job wants ONE Optin's fact and would otherwise pull every Optin's row
     * off disk per job to read a single key. The one caller is
     * {@see \WConvert\Destination\LeadMagnet\DeliveryCount}, which asks
     * whether the delivery it just made is one the analytics screen counts.
     *
     * **Soft-deleted Optins included**, again for `nameOf()`'s reason and one
     * of its own: a [[Lead]] outlives the Optin that captured it, and
     * {@see \WConvert\Stats\Dashboard} interprets counts against
     * soft-deleted Optins on purpose (ADR 0020). An Optin unpublished or
     * tidied away between capture and delivery still owns the delivery.
     *
     * Null where the row is gone or the column holds a Goal this build cannot
     * interpret — {@see Goal::tryFrom()} is the one place the closed set is
     * enforced over a `VARCHAR` column (ADR 0019).
     */
    public function goalOf(string $id): ?Goal
    {
        $row = $this->db->row(Connection::TABLE_OPTINS, 'SELECT goal FROM %i WHERE id = %s', $id);

        return $row === null ? null : Goal::tryFrom((string) ($row['goal'] ?? ''));
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
     * Promote the working draft onto the live one, rebuild the set, and — the
     * first time only — record that this site activated.
     */
    public function publish(string $id): ?Optin
    {
        $optin = $this->find($id);

        // A deleted Optin cannot be published back into existence. Undeleting
        // is its own act, and this is not it.
        if ($optin === null || $optin->isDeleted()) {
            return null;
        }

        // Keep this at the promotion boundary as well as in REST: a CLI or
        // future bulk action must not publish a draft with no design. Saving
        // that incomplete draft remains valid and never changes the live set.
        if (!$optin->hasDesign() || \WConvert\Template\TemplateForm::issue($optin->config['template'] ?? null) !== null) {
            return null;
        }

        $now = current_time('mysql');

        $this->db->update(Connection::TABLE_OPTINS, [
            'published_config' => (string) wp_json_encode($optin->config),
            'published_at' => $now,
        ], ['id' => $id]);

        // ====================================================================
        // THE ACTIVATION MILESTONE, AND WHY IT IS NOT `MIN(published_at)`.
        // ====================================================================
        // The obvious derivation is the minimum of the column just written,
        // and it is wrong: {@see self::unpublish()} sets that column back to
        // `NULL`, so the minimum over it moves FORWARDS the day a merchant
        // takes their oldest Optin down. A milestone that resets is not one
        // (#94, {@see MilestoneStore}).
        //
        // The day is cut off the timestamp this statement just wrote rather
        // than read again, so the milestone and `published_at` cannot disagree
        // about which day it was — including across a midnight this method
        // happens to straddle. `current_time('mysql')` is already the SITE's
        // clock, which is the clock every other milestone is stamped on
        // ({@see \WConvert\Stats\StatDay}).
        $this->milestones->recordFirstPublish(substr($now, 0, 10));

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
     * ========================================================================
     * REBUILD THE SET BECAUSE THE PLUGIN WAS INSTALLED OR UPGRADED — AND FOR
     * NO OTHER REASON.
     * ========================================================================
     * **The one public rebuild, and it is named after its single caller** so
     * that the name is the argument. Below, `rebuildPublishedSet()` is private
     * on the stated grounds that "a public rebuild is an invitation to call it
     * on read", and that stays true: this is not a second door onto the same
     * room, it is one more named operation with a docblock saying which single
     * event it exists to express — the shape {@see \WConvert\Database\Connection}
     * used both times it was widened.
     *
     * `wconvert_published_set` is the only one of WConvert's options that is
     * not normalised through a value object on the way out of storage: it
     * holds the whole projection as a plain array, written whole and read
     * whole (ADR 0003). Everywhere else, WConvert avoids migrations by
     * normalising on every write against a closed vocabulary and reading
     * tolerantly with defaults — and that fails here for one reason, which is
     * that **nobody writes.** ADR 0003 rebuilds the set on write and never on
     * read, so a plugin update that changes the projection's shape leaves
     * every stored entry at the old shape until a merchant happens to
     * republish. An Optin published once and never touched again would keep
     * the shape it was published at forever.
     *
     * {@see \WConvert\Database\Installer::install()} runs on exactly the event
     * that means "the code that builds this changed", from activation and from
     * `admin_init`, and it is the general case of a data step the upgrade path
     * otherwise has nowhere to put. One call, not a framework: re-running the
     * current DDL is what makes skipping versions free, and a stepwise
     * migration runner would give that up to solve a problem this does not
     * have.
     */
    public function rebuildForInstall(): void
    {
        $this->rebuildPublishedSet();
    }

    /**
     * The site's timezone changed, so every [[Schedule]] means a different
     * instant now.
     *
     * ========================================================================
     * ITS OWN NAME, BESIDE {@see self::rebuildForInstall()}, FOR THAT
     * METHOD'S STATED REASON.
     * ========================================================================
     * A public rebuild is an invitation to call it on read, so each of the two
     * legitimate callers gets a name that makes calling it on read read wrong.
     * One generic `rebuild()` would give that property up to save a method.
     *
     * This is the second and last event other than an Optin write that changes
     * what the projection would produce: a window is STORED as the local wall
     * time the merchant typed and RESOLVED against `wp_timezone()` here
     * (ADR 0050), so a merchant correcting a wrong site timezone corrects
     * every schedule with it — and without this the correction would wait for
     * the next unrelated publish, which may never come.
     */
    public function rebuildForTimezoneChange(): void
    {
        $this->rebuildPublishedSet();
    }

    /**
     * Rebuild the published set from the table.
     *
     * Private: every caller that should reach it is in this class, and a
     * public rebuild is an invitation to call it on read.
     * {@see self::rebuildForInstall()} is the one exception, and it is named
     * so that calling it on read reads wrong.
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
        // **The site's zone, read at every rebuild.** An Optin's schedule is
        // stored as the local wall time the merchant authored and resolved to
        // an absolute instant here, so changing the site timezone re-resolves
        // every schedule on the next rebuild rather than leaving instants
        // frozen at whatever the zone was when somebody pressed Publish.
        // `wp_timezone()` for the reason {@see \WConvert\Stats\StatDay} gives:
        // it returns the zone as an object and honours both halves of
        // WordPress's setting — a named zone with its own DST history, or a
        // bare UTC offset for a site that never picked one.
        $this->publishedSet->replaceWith(
            PublishedProjection::build($rows, $this->vocabulary, wp_timezone())
        );
    }
}
