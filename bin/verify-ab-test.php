<?php

/**
 * verify-ab-test.php — an A/B test, against a real database.
 *
 *     wp eval-file bin/verify-ab-test.php
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * ============================================================================
 * WHY THIS EXISTS AND A UNIT TEST DOES NOT DO IT.
 * ============================================================================
 * `tests/unit/Support/FakeConnection.php` models the TABLE and ignores the
 * query text, deliberately and correctly — *"the SQL itself is verified where
 * SQL can only be verified, on a real WordPress"*. Every claim below is a claim
 * about a `WHERE`:
 *
 * - **The Optins list shows parentless Optins only** (ADR 0045). This is the
 *   entire UI half of that decision and it is one `WHERE parent_id IS NULL` —
 *   which the fake answers as though it were not there, so a unit test asserting
 *   it would pass against a repository that had never written it.
 * - **`declareWinner()` issues no `DELETE`.** The unit test reads the fake's
 *   delete log; this reads the real table and finds the row still in it, which
 *   is the claim ADR 0020 actually makes.
 * - **The counters are untouched, and two arms accumulate apart.** Two
 *   `(optin_id, stat_date, kind)` upserts against two arms have to produce two
 *   rows, and the only thing that can be watched not widening a key is a
 *   database. This is `bin/verify-stats.php`'s arrangement for a second caller.
 * - **The published set describes the test, then stops.** The payload's arm
 *   triple is computed across the whole set at rebuild time (ADR 0003), so what
 *   is checked is the JSON that actually landed in `wp_options`.
 *
 * It runs on SQLite, so Playground is enough — nothing here needs MySQL. See
 * README's *Running a `bin/verify-*.php` script under Playground*.
 *
 * IT REFUSES TO RUN ON A SITE THAT HAS OPTINS. It writes rows and rebuilds the
 * published set, which is a live site's front end.
 */

declare(strict_types=1);

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedProjection;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;
use WConvert\Storage\WpOptionStore;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-ab-test.php\n");

    exit(2);
}

/**
 * The checks, and what failed.
 *
 * A tiny object rather than a global, for `bin/verify-schedule.php`'s reason:
 * `bin/` is analysed at PHPStan level 7 like everything else, and a global
 * mutated inside a function is a value static analysis cannot follow.
 */
final class AbTestVerification
{
    /** @var list<string> */
    public array $failures = [];

    /**
     * @param mixed $expected
     * @param mixed $actual
     */
    public function check(string $claim, $expected, $actual): void
    {
        if ($expected === $actual) {
            echo "  ok   {$claim}\n";

            return;
        }

        $this->failures[] = $claim;

        echo "  FAIL {$claim}\n";
        echo '       expected: ' . var_export($expected, true) . "\n";
        echo '       actual:   ' . var_export($actual, true) . "\n";
    }
}

$verify = new AbTestVerification();

global $wpdb;

$options = new WpOptionStore();
$db = new WpdbConnection($wpdb);
$set = new PublishedSet($options);
$optins = new OptinRepository($db, $set, RuleVocabulary::fromManifest(), new MilestoneStore($options));
$stats = new StatsRepository($db);

(new Installer($options, $optins))->install();

$optinTable = $wpdb->prefix . Connection::TABLE_OPTINS;
$statsTable = $wpdb->prefix . Connection::TABLE_STATS;

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$optinTable}`") !== 0) {
    fwrite(STDERR, "{$optinTable} is not empty. This writes Optins and rebuilds the published set, which is a "
        . "live site's front end — boot a throwaway WordPress instead (see README.md).\n");

    exit(2);
}

/** One entry of the published option, by id. */
$entryFor = static function (string $id) use ($set): ?array {
    foreach ($set->all() as $entry) {
        if (($entry['id'] ?? null) === $id) {
            return $entry;
        }
    }

    return null;
};

$config = TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest())->snapshotInto(['template_id' => 'centred-card']) + [
    'targeting' => [],
    'display_type' => 'popup',
    'display_rules' => \WConvert\Rules\DisplayPlan::immediate(),
];

echo "\nStarting a test\n";

$parent = $optins->create('Spring sale', 'grow_email_list', $config);
$armB = $optins->createVariant($parent->id);

$verify->check('a variant is a second Optin', true, $armB !== null && $armB->id !== $parent->id);
$verify->check('it names its parent in the column', $parent->id, $armB?->parentId);
$verify->check('and takes its parent\'s name with a letter', 'Spring sale (B)', $armB?->name);

$armBId = (string) $armB?->id;

// ============================================================================
// THE LIST, WHICH IS THE ONE THING THE FAKE CONNECTION CANNOT ANSWER.
// ============================================================================
// `summaries()` filters `parent_id IS NULL` in SQL, and the whole UI half of
// ADR 0045 is that filter: a merchant running three tests must meet three
// campaigns rather than six. The in-memory fake ignores the `WHERE` and hands
// back every row, so this is the only place the claim can be made.
$verify->check(
    'the list is parentless Optins only',
    [$parent->id],
    array_column($optins->summaries(), 'id')
);

$verify->check(
    'and the arms are read back beneath their parent',
    [$armBId],
    array_column($optins->armsByParent()[$parent->id] ?? [], 'id')
);

echo "\nWhat the page receives\n";

$optins->publish($parent->id);
$optins->publish($armBId);

$verify->check(
    'the parent is arm 0 of two',
    [$parent->id, 0, 2],
    $entryFor($parent->id)['payload'][PublishedProjection::ARM] ?? null
);

$verify->check(
    'and the variant is arm 1 of two',
    [$parent->id, 1, 2],
    $entryFor($armBId)['payload'][PublishedProjection::ARM] ?? null
);

// The set is stored as a plain array in `wp_options` and read whole by the
// front end (ADR 0003), so the triple has to survive a JSON round trip through
// the database rather than merely existing in PHP.
$stored = get_option(PublishedSet::OPTION);

$verify->check(
    'and it survives the option round trip as three scalars',
    true,
    is_array($stored) && str_contains((string) wp_json_encode($stored), '"' . PublishedProjection::ARM . '":["' . $parent->id . '",1,2]')
);

echo "\nTwo arms, counted apart\n";

// ============================================================================
// THE HALF OF ADR 0045 IT SPENDS MOST OF ITS WORDS ON.
// ============================================================================
// `wconvert_stats` is keyed `(optin_id, stat_date, kind)` and a Variant that IS
// an Optin gets its counters out of that key — no `variant_id`, no widened key,
// no second table. Interleaved on purpose: the failure this would catch is an
// arithmetic that folded an arm's counts into its parent, and alternating
// writes is what makes that visible as a wrong number rather than a missing row.
$today = current_time('Y-m-d');

foreach ([[$parent->id, 3], [$armBId, 2], [$parent->id, 1], [$armBId, 4]] as [$id, $times]) {
    for ($n = 0; $n < $times; $n++) {
        $stats->increment($id, StatKind::Impression, $today);
    }
}

$stats->increment($parent->id, StatKind::Conversion, $today);
$stats->increment($armBId, StatKind::Conversion, $today);
$stats->increment($armBId, StatKind::Conversion, $today);

$countFor = static function (string $id, string $kind) use ($wpdb, $statsTable, $today): int {
    return (int) $wpdb->get_var($wpdb->prepare(
        "SELECT count FROM `{$statsTable}` WHERE optin_id = %s AND stat_date = %s AND kind = %s",
        $id,
        $today,
        $kind
    ));
};

$verify->check('arm A has its own impressions', 4, $countFor($parent->id, StatKind::Impression->value));
$verify->check('arm B has its own impressions', 6, $countFor($armBId, StatKind::Impression->value));
$verify->check('arm A has its own conversions', 1, $countFor($parent->id, StatKind::Conversion->value));
$verify->check('arm B has its own conversions', 2, $countFor($armBId, StatKind::Conversion->value));

// The counters carry no `variant_id` and never did. Asked of the real table
// rather than of the DDL string, because what a schema SAYS and what an install
// has can differ by one `dbDelta` run (ADR 0045, ADR 0019).
$columns = array_map(
    static fn (object $row): string => (string) ($row->name ?? $row->Field ?? ''),
    (array) $wpdb->get_results("PRAGMA table_info(`{$statsTable}`)") ?: (array) $wpdb->get_results("SHOW COLUMNS FROM `{$statsTable}`")
);

$verify->check(
    'and the counters are the four columns they always were',
    ['optin_id', 'stat_date', 'kind', 'count'],
    array_values(array_filter($columns))
);

echo "\nEnding it\n";

$rowsBefore = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$optinTable}`");

$verify->check('declaring a winner is accepted', true, $optins->declareWinner($parent->id, $armBId));

// ============================================================================
// ADR 0020: THE LOSING ROW STAYS, AND ITS COUNTS STAY READABLE.
// ============================================================================
// The unit test reads the fake's delete log. This reads the table.
$verify->check(
    'no row was removed',
    $rowsBefore,
    (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$optinTable}`")
);

$verify->check(
    'the arm that lost is soft-deleted',
    true,
    $optins->find($parent->id)?->deletedAt !== null
);

$verify->check(
    'and its counters still read',
    4,
    $countFor($parent->id, StatKind::Impression->value)
);

// The winner becomes the campaign rather than being copied onto it, so every
// row's counters keep meaning exactly one design (ADR 0058).
$winner = $optins->find($armBId);

$verify->check('the winner has no parent', null, $winner?->parentId);

// And the arm that lost hangs beneath it, so the whole test's history follows
// the campaign that won and a retired letter is never handed out twice
// (ADR 0058).
$verify->check(
    'and the arm that lost hangs beneath the winner',
    $armBId,
    $optins->find($parent->id)?->parentId
);

$verify->check(
    'so the next variant of it takes the next letter',
    'Spring sale (C)',
    $optins->createVariant($armBId)?->name
);
$verify->check('and it is the campaign', 'Spring sale', $winner?->name);
$verify->check('so the list is one campaign again', [$armBId], array_column($optins->summaries(), 'id'));

// And the test is over in the only place that records it. There is no
// `finished` column to set and none to forget.
$verify->check(
    'the payload has stopped describing a test',
    false,
    array_key_exists(PublishedProjection::ARM, $entryFor($armBId)['payload'] ?? [])
);

$verify->check(
    'and the site is serving the winner alone',
    [$armBId],
    array_column($set->all(), 'id')
);

echo "\nCleaning up\n";

foreach ($wpdb->get_col("SELECT id FROM `{$optinTable}`") as $id) {
    $wpdb->query($wpdb->prepare("DELETE FROM `{$optinTable}` WHERE id = %s", $id));
    $wpdb->query($wpdb->prepare("DELETE FROM `{$statsTable}` WHERE optin_id = %s", $id));
}

// Derived state rebuilt on write, so it has to be told the rows are gone.
$set->replaceWith([]);

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
