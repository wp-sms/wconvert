<?php

/**
 * verify-stats.php — the counters, against a real MySQL.
 *
 *     wp eval-file bin/verify-stats.php
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * WHY THIS EXISTS AND A UNIT TEST DOES NOT DO IT. The whole justification for
 * `wconvert_stats`' shape is a claim about the DATABASE: that
 * `INSERT ... ON DUPLICATE KEY UPDATE count = count + 1` is atomic, so two
 * beacons arriving in the same instant produce two and no increment is ever
 * lost (ADR 0019). `tests/unit/Stats/` proves the statement that is issued,
 * against a fake that records the upsert and does not apply it — deliberately,
 * because a fake that added up the increments itself would be the authority on
 * what MySQL does. So the one claim it cannot make is this one.
 *
 * **MySQL, not SQLite.** `ON DUPLICATE KEY UPDATE` is MySQL's spelling and the
 * concurrency check needs two real connections holding real row locks, so this
 * one does NOT run on Playground the way `bin/verify-lead-log.php` does. Point
 * it at Local:
 *
 *     php -d mysqli.default_socket="$HOME/Library/Application Support/Local/run/<id>/mysql/mysqld.sock" \
 *       "$(which wp)" eval-file bin/verify-stats.php
 *
 * IT REFUSES TO RUN ON A SITE THAT ALREADY HAS COUNTS. The counters can never
 * be recomputed — there is no raw data behind them — so a merchant's numbers
 * are not something to be careful around. They are something to refuse. It
 * refuses on a non-empty LEAD LOG for the same reason: one of the dashboard
 * checks below writes a [[Lead]] and erases it again, to prove that neither
 * act moves a reported number.
 *
 * IT ALSO VERIFIES THE DASHBOARD, and for the same class of reason. #28 reads
 * `wconvert_stats` and interprets it through `wconvert_optins` in PHP rather
 * than in a `JOIN` (ADR 0034), so the claims that need a database are: that
 * `BETWEEN` over a `DATE` column really includes both ends, that correcting an
 * Optin's `goal` really restates its whole history, that a `deleted_at` stamp
 * really keeps the counts and loses the row — and that **no query the screen
 * issues names `wconvert_leads`**, which is checked against the real query log
 * rather than against the source (ADR 0018, ADR 0020).
 */

declare(strict_types=1);

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Lead\LeadRepository;
use WConvert\Lead\Submission;
use WConvert\Milestone\Milestones;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\RateLimit;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;
use WConvert\Storage\WpOptionStore;
use WConvert\Support\Ulid;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-stats.php\n");

    exit(2);
}

/**
 * The checks, and what failed.
 *
 * A tiny object rather than a function over a global, for the reason
 * `bin/verify-lead-log.php` gives: this file is analysed at PHPStan level 7
 * like everything else in `bin/`, and a global mutated inside a function is a
 * value static analysis cannot follow.
 */
final class StatsVerification
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

/**
 * A second connection to the same database, opened the way WordPress opened
 * the first one.
 *
 * The concurrency check needs two, and `wpdb` keeps its handle protected — so
 * these are raw mysqli, built from the same `DB_*` constants `wp-config.php`
 * gave `wpdb`. `DB_HOST` carries the port or the socket path in WordPress's own
 * `host:port` / `host:/path/to.sock` spelling, so it is split here the same way
 * `wpdb::parse_db_host()` splits it.
 */
function wconvert_verify_connect(): mysqli
{
    $host = (string) DB_HOST;
    $port = null;
    $socket = null;

    if (str_contains($host, ':')) {
        [$host, $tail] = explode(':', $host, 2);

        if (str_starts_with($tail, '/')) {
            $socket = $tail;
        } else {
            $port = (int) $tail;
        }
    }

    // `localhost` with no explicit socket is exactly the case mysqli resolves
    // through `mysqli.default_socket`, which is why the invocation at the top
    // of this file passes one.
    $connection = new mysqli($host, DB_USER, DB_PASSWORD, DB_NAME, $port ?? 3306, $socket ?? '');

    $connection->set_charset('utf8mb4');

    return $connection;
}

/**
 * Wait for an asynchronous query, and say whether it finished in time.
 *
 * `mysqli_poll()` rewrites the arrays it is handed, so they are rebuilt per
 * call rather than reused.
 */
function wconvert_verify_poll(mysqli $connection, int $seconds, int $microseconds = 0): int
{
    $read = [$connection];
    $error = [$connection];
    $reject = [$connection];

    return (int) mysqli_poll($read, $error, $reject, $seconds, $microseconds);
}

$verify = new StatsVerification();

global $wpdb;

$options = new WpOptionStore();
$db = new WpdbConnection($wpdb);

// The Optin repository, hoisted above the install because the installer now
// takes one: `install()` rebuilds the published set, which is the one piece of
// WConvert's derived state nothing rewrites on its own (ADR 0003). It is the
// same object the read checks use further down — one of it, so the rows this
// script writes and the rows it reads back cannot come from two graphs.
$optins = new OptinRepository($db, new PublishedSet($options), RuleVocabulary::fromManifest(), new MilestoneStore($options));

(new Installer($options, $optins))->install();

$statsTable = $wpdb->prefix . Connection::TABLE_STATS;

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$statsTable}`") !== 0) {
    fwrite(STDERR, "{$statsTable} is not empty. The counters cannot be recomputed, so this refuses to touch "
        . "a site that already has some — boot a throwaway WordPress instead (see README.md).\n");

    exit(2);
}

$leadTable = $wpdb->prefix . Connection::TABLE_LEADS;

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`") !== 0) {
    fwrite(STDERR, "{$leadTable} is not empty. One dashboard check writes a Lead and erases it again to prove "
        . "that neither act moves a reported number — boot a throwaway WordPress instead (see README.md).\n");

    exit(2);
}

if ($options->get(MilestoneStore::OPTION) !== null) {
    fwrite(STDERR, "This site already holds milestones. Four of the five are recorded ONCE and cannot be "
        . "recomputed either, so this refuses to overwrite them — boot a throwaway WordPress instead "
        . "(see README.md).\n");

    exit(2);
}

$stats = new StatsRepository($db);

/** The count on one row, or null where there is no row. */
$countOf = static function (string $optinId, string $kind, string $date) use ($wpdb, $statsTable): ?int {
    $value = $wpdb->get_var($wpdb->prepare(
        "SELECT `count` FROM `{$statsTable}` WHERE optin_id = %s AND stat_date = %s AND kind = %s",
        $optinId,
        $date,
        $kind
    ));

    return $value === null ? null : (int) $value;
};

echo "The table\n";

$columns = $wpdb->get_col("SHOW COLUMNS FROM `{$statsTable}`");

$verify->check('it has the four approved columns and no surrogate id', ['optin_id', 'stat_date', 'kind', 'count'], $columns);

$indexes = $wpdb->get_results("SHOW INDEX FROM `{$statsTable}`", ARRAY_A);
$indexNames = array_values(array_unique(array_map(
    static fn (array $index): string => (string) $index['Key_name'],
    is_array($indexes) ? $indexes : []
)));

$verify->check('the composite primary key is the only index there is', ['PRIMARY'], $indexNames);

$keyColumns = [];

foreach (is_array($indexes) ? $indexes : [] as $index) {
    if ((string) $index['Key_name'] === 'PRIMARY') {
        $keyColumns[(int) $index['Seq_in_index']] = (string) $index['Column_name'];
    }
}

ksort($keyColumns);

$verify->check('and it is keyed for the one query it serves', ['optin_id', 'stat_date', 'kind'], array_values($keyColumns));

echo "The upsert\n";

$today = StatDay::today();
$optinId = Ulid::generate();

$stats->increment($optinId, StatKind::Impression, $today);

$verify->check('the first act creates the row', 1, $countOf($optinId, 'impression', $today));

$stats->increment($optinId, StatKind::Impression, $today);

$verify->check('the second increments it rather than failing on the key', 2, $countOf($optinId, 'impression', $today));

$stats->increment($optinId, StatKind::Conversion, $today);

$verify->check('a different kind is a different row', 1, $countOf($optinId, 'conversion', $today));
$verify->check('and does not disturb the first', 2, $countOf($optinId, 'impression', $today));

$stats->increment($optinId, StatKind::Impression, '2026-01-01');

$verify->check('a different day is a different row', 1, $countOf($optinId, 'impression', '2026-01-01'));
$verify->check('the upsert ran without error', '', (string) $wpdb->last_error);

echo "The upsert under concurrency\n";

// ==========================================================================
// THE CHECK THIS FILE EXISTS FOR.
// ==========================================================================
// Two connections, the second firing while the first holds the row lock. If
// the write were a read-modify-write in PHP, both would read the same number
// and both would write the same successor, and one act would be gone.
$raced = Ulid::generate();
$race = sprintf(
    "INSERT INTO `%s` (optin_id, stat_date, kind, `count`) VALUES ('%s', '%s', 'impression', 1)"
        . " ON DUPLICATE KEY UPDATE `count` = `count` + 1",
    $statsTable,
    $raced,
    $today
);

$first = wconvert_verify_connect();
$second = wconvert_verify_connect();

$verify->check('two connections were opened', ['', ''], [$first->connect_error ?? '', $second->connect_error ?? '']);

for ($round = 1; $round <= 2; $round++) {
    // Round one collides two INSERTs on a row that does not exist yet; round
    // two collides two increments on a row that does. They are different locks
    // and the claim has to hold for both.
    $first->begin_transaction();
    $first->query($race);

    $second->query($race, MYSQLI_ASYNC);

    // 200ms is long enough that "not ready" means BLOCKED rather than "not
    // scheduled yet" — which is the half of this check that proves there was
    // real contention rather than two writes that happened to be sequential.
    $verify->check(
        "round {$round}: the second write blocks while the first holds the row",
        0,
        wconvert_verify_poll($second, 0, 200000)
    );

    $first->commit();

    $verify->check("round {$round}: and completes once the first commits", 1, wconvert_verify_poll($second, 5));

    $second->reap_async_query();

    $verify->check("round {$round}: no increment was lost", $round * 2, $countOf($raced, 'impression', $today));
}

// ==========================================================================
// AND THE CONTROL, SO THE CHECK ABOVE IS KNOWN TO BE ABLE TO FAIL.
// ==========================================================================
// The same two increments as a read-modify-write: both read, then both write
// what they computed. This is the shape ADR 0008 accepted for Destination
// health BECAUSE health is advisory — a conversion count is not.
$lost = Ulid::generate();

$readA = $countOf($lost, 'impression', $today) ?? 0;
$readB = $countOf($lost, 'impression', $today) ?? 0;

foreach ([$readA, $readB] as $read) {
    $wpdb->query($wpdb->prepare(
        "INSERT INTO `{$statsTable}` (optin_id, stat_date, kind, `count`) VALUES (%s, %s, 'impression', %d)"
            . " ON DUPLICATE KEY UPDATE `count` = %d",
        $lost,
        $today,
        $read + 1,
        $read + 1
    ));
}

$verify->check('a read-modify-write loses one, which is why this is not one', 1, $countOf($lost, 'impression', $today));

$first->close();
$second->close();

echo "The site's day\n";

// A zone whose calendar date differs from UTC's RIGHT NOW, whenever this runs.
// Kiritimati is UTC+14 and is already tomorrow from 10:00 UTC; UTC-12 is still
// yesterday until 12:00 UTC. One of the two always applies.
$utcToday = gmdate('Y-m-d');
$elsewhere = ((int) gmdate('G')) >= 10 ? 'Pacific/Kiritimati' : 'Etc/GMT+12';

$originalZone = get_option('timezone_string');
$originalOffset = get_option('gmt_offset');

update_option('timezone_string', $elsewhere);

$siteToday = StatDay::today();

$verify->check("with the site on {$elsewhere}, its day is not UTC's", true, $siteToday !== $utcToday);

$timezoned = Ulid::generate();

$stats->increment($timezoned, StatKind::Conversion, StatDay::today());

$stamped = (string) $wpdb->get_var($wpdb->prepare(
    "SELECT stat_date FROM `{$statsTable}` WHERE optin_id = %s",
    $timezoned
));

$verify->check("the row is stamped with the merchant's day", $siteToday, $stamped);
$verify->check("and not with UTC's", true, $stamped !== $utcToday);

update_option('timezone_string', $originalZone);
update_option('gmt_offset', $originalOffset);

echo "The dashboard\n";

// ==========================================================================
// THE READ, AGAINST REAL SQL.
// ==========================================================================
// Everything above proved the WRITE. These prove the read: that a `BETWEEN`
// over a DATE column includes both of its ends, that an `UPDATE` to an Optin's
// `goal` really does restate every day of its history, and that a `deleted_at`
// stamp keeps the counts while taking the row (ADR 0020).
//
// The unit suite proves the same arithmetic against rows it handed itself.
// What it cannot prove is that the rows arriving from MySQL are those rows.
$dashboard = new Dashboard($stats, $optins);

$reported = $optins->create('Reported', 'grow_email_list', []);
$tidied = $optins->create('Tidied away', 'grow_email_list', []);

$today = StatDay::today();
$window = StatRange::lastDays(30, $today);
$edge = $window->from;
$outside = (new DateTimeImmutable($edge, new DateTimeZone('UTC')))->modify('-1 day')->format(StatDay::FORMAT);

foreach ([$reported->id, $tidied->id] as $id) {
    foreach ([$edge, $today] as $day) {
        $stats->increment($id, StatKind::Impression, $day);
        $stats->increment($id, StatKind::Impression, $day);
        $stats->increment($id, StatKind::Conversion, $day);
    }

    // A day before the window opens, which must never be counted.
    $stats->increment($id, StatKind::Conversion, $outside);
}

/** One Goal's card, or null where the screen produced none. @param array<string, mixed> $payload */
$cardFor = static function (array $payload, string $goal): ?array {
    /** @var list<array<string, mixed>> $cards */
    $cards = $payload['goals'];

    foreach ($cards as $card) {
        if ($card['goal'] === $goal) {
            return $card;
        }
    }

    return null;
};

$card = $cardFor($dashboard->read($window), 'grow_email_list');

$verify->check('the screen produces a card for the Goal its Optins hold', true, $card !== null);
$verify->check('both ends of the window are inside it', 4, $card['headline'] ?? null);
$verify->check('the denominator came back too', 8, $card['impressions'] ?? null);

// The same counters read over a window one day wider. BETWEEN is inclusive at
// both ends, so the two conversions stamped the day before the first window
// opened appear here and nowhere above.
$verify->check(
    'a day outside the window is excluded, and a wider window picks it up',
    6,
    $cardFor($dashboard->read(StatRange::lastDays($window->days() + 1, $today)), 'grow_email_list')['headline'] ?? null
);
$verify->check('and the rate is conversions over impressions', 0.5, $card['conversion_rate'] ?? null);

// The one-day window, which is what the merchant means by "Today".
$todayCard = $cardFor($dashboard->read(StatRange::lastDays(1, $today)), 'grow_email_list');

$verify->check("a one-day window is today alone", 2, $todayCard['headline'] ?? null);

echo "Interpreting at read\n";

// ==========================================================================
// THE DECISION THIS TICKET EXISTS FOR.
// ==========================================================================
// One `UPDATE` to one column in `wconvert_optins`, no counter touched, and
// EVERY day of the history reads differently. Correcting a mis-set Goal makes
// an Optin's whole history right rather than splitting it permanently in two
// at the moment of the edit (ADR 0020). It will look like a bug to someone.
$beforeCorrection = $cardFor($dashboard->read($window), 'grow_email_list');

$optins->saveDraft($reported->id, null, 'promote_offer', null);
$optins->saveDraft($tidied->id, null, 'promote_offer', null);

$afterCorrection = $dashboard->read($window);

$verify->check(
    'the Goal they were corrected away from keeps no card at all',
    null,
    $cardFor($afterCorrection, 'grow_email_list')
);
$verify->check(
    'and the whole history arrived under the corrected one',
    $beforeCorrection['headline'] ?? null,
    $cardFor($afterCorrection, 'promote_offer')['headline'] ?? null
);
$verify->check(
    'every day of it, not a series that changes shape half way along',
    $beforeCorrection['by_day'] ?? null,
    $cardFor($afterCorrection, 'promote_offer')['by_day'] ?? null
);

// Put them back, so the checks below read the Goal they were filed under.
$optins->saveDraft($reported->id, null, 'grow_email_list', null);
$optins->saveDraft($tidied->id, null, 'grow_email_list', null);

echo "Tidying up an Optin\n";

$optins->delete($tidied->id);

$afterDelete = $cardFor($dashboard->read($window), 'grow_email_list');

$verify->check(
    "February's goal total did not fall when March tidied up",
    $card['headline'] ?? null,
    $afterDelete['headline'] ?? null
);
$verify->check(
    'and the deleted Optin is gone from the list of what is running',
    [$reported->id],
    array_column($afterDelete['optins'] ?? [], 'id')
);
$verify->check(
    'and the one that is still reports its own numbers',
    [2],
    array_column($afterDelete['optins'] ?? [], 'headline')
);

echo "The lead log, which no reported number comes from\n";

// ==========================================================================
// ADR 0018 DEPENDS ON THIS DERIVATION NOT EXISTING.
// ==========================================================================
// Erasure DELETEs Lead rows, chosen so that anonymising — which is an update —
// never had to become one against a table with no update path. That is safe
// only while no metric reads those rows: a "Leads with an email" taken from
// `wconvert_leads` would let one erasure request silently rewrite a merchant's
// conversion history, with nothing to repair it from.
//
// `tests/unit/Stats/NoCountComesFromTheLeadLogTest.php` reads the SOURCE for
// that. This reads the QUERY LOG, and then the numbers themselves.
$leads = new LeadRepository($db);

$leads->record($reported->id, new Submission('erased@example.com', null, ['name' => 'Sarah']));

$verify->check('a Lead really landed in the log', 1, (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`"));
$verify->check(
    'and capturing it moved no reported number',
    $afterDelete,
    $cardFor($dashboard->read($window), 'grow_email_list')
);

$leads->eraseByEmail('erased@example.com');

$verify->check('the Lead was erased', 0, (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`"));
$verify->check(
    'and erasing it rewrote no history either',
    $afterDelete,
    $cardFor($dashboard->read($window), 'grow_email_list')
);

// And the same claim read off the query log rather than off the numbers: a
// count that MOVED would be caught above, but a screen that merely READS the
// table is one edit away from reporting it.
// Read BEFORE defining it, so a site that has deliberately switched the query
// log off is skipped rather than overridden.
$queryLog = !defined('SAVEQUERIES') || (bool) constant('SAVEQUERIES');

if (!defined('SAVEQUERIES')) {
    define('SAVEQUERIES', true);
}

if ($queryLog) {
    $wpdb->queries = [];

    $dashboard->read($window);

    /** @var list<array<int, mixed>> $logged */
    $logged = is_array($wpdb->queries) ? $wpdb->queries : [];
    $texts = array_map(static fn (array $entry): string => (string) ($entry[0] ?? ''), $logged);

    $verify->check('the screen issued some queries to look at', true, $texts !== []);
    $verify->check('and not one of them names the lead log', [], array_values(array_filter(
        $texts,
        static fn (string $sql): bool => str_contains($sql, Connection::TABLE_LEADS)
    )));
    $verify->check('it is two statements, one per table', 2, count($texts));
    $verify->check('and neither is a JOIN', [], array_values(array_filter(
        $texts,
        static fn (string $sql): bool => stripos($sql, ' join ') !== false
    )));
} else {
    echo "  skip SAVEQUERIES is defined false, so the query log cannot be read\n";
}

echo "The dashboard's today\n";

// ==========================================================================
// "TODAY MEANS THE MERCHANT'S TODAY", THROUGH THE WHOLE SCREEN.
// ==========================================================================
// The unit suite cannot reach this: `tests/bootstrap.php` answers every clock
// as though the site were on UTC, deliberately and consistently, so a test
// built on those stubs would agree with the bootstrap rather than with
// WordPress. `StatRange` takes the day as an argument for exactly that reason,
// and this is where the one line that ASKS WordPress is proven.
$zoned = $optins->create('Timezoned', 'promote_offer', []);

update_option('timezone_string', $elsewhere);

$siteToday = StatDay::today();

$verify->check("the site's day is still not UTC's", true, $siteToday !== gmdate('Y-m-d'));

// One act on the site's today, one on UTC's. A one-day window must hold the
// first and not the second.
$stats->increment($zoned->id, StatKind::Conversion, $siteToday);
$stats->increment($zoned->id, StatKind::Conversion, gmdate('Y-m-d'));

$zonedCard = $cardFor($dashboard->read(StatRange::lastDays(1, StatDay::today())), 'promote_offer');

$verify->check("today's window is the merchant's day", 1, $zonedCard['headline'] ?? null);
$verify->check('and it says which day that was', $siteToday, $zonedCard === null ? null : array_key_first($zonedCard['by_day']));

update_option('timezone_string', $originalZone);
update_option('gmt_offset', $originalOffset);

echo "The beacon endpoint\n";

// `rest_do_request()` builds a real request, runs the permission callback and
// dispatches to the real route — everything an HTTP call would do except the
// socket. Nothing else can prove the controller wires its three collaborators
// together, because a `WP_REST_Request` faithful enough to prove it is a
// WordPress install with extra steps.
$published = $optins->create('Beacon check', 'grow_email_list', []);
$optins->publish($published->id);
$unpublished = $optins->create('Never published', 'grow_email_list', []);

// A beacon always arrives over HTTP and therefore always has these. WP-CLI has
// neither, so the request the rate limit and the bot filter see would otherwise
// be one no browser could ever send.
$_SERVER['REMOTE_ADDR'] = '203.0.113.42';

$chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)'
    . ' Chrome/140.0.0.0 Safari/537.36';

/**
 * One beacon request, dispatched.
 *
 * @param list<array{optin_id: string, kind: string}> $events
 * @param array<string, string> $headers
 */
$beacon = static function (array $events, array $headers = []) use ($chrome): int {
    $request = new WP_REST_Request('POST', '/' . Routes::NAMESPACE . '/beacon');

    $request->set_header('content-type', 'application/json');
    $request->set_header('user-agent', $chrome);

    foreach ($headers as $header => $value) {
        $request->set_header($header, $value);
    }

    $request->set_body((string) wp_json_encode(['events' => $events]));

    return rest_do_request($request)->get_status();
};

$beaconDay = StatDay::today();

$verify->check(
    'a beacon for a published Optin is accepted',
    204,
    $beacon([['optin_id' => $published->id, 'kind' => 'impression']])
);
$verify->check('and lands as a count', 1, $countOf($published->id, 'impression', $beaconDay));

$beacon([
    ['optin_id' => $published->id, 'kind' => 'conversion'],
    ['optin_id' => $published->id, 'kind' => 'dismiss'],
]);

$verify->check('a coalesced flush counts each act once', 1, $countOf($published->id, 'conversion', $beaconDay));
$verify->check('including the Dismissal', 1, $countOf($published->id, 'dismiss', $beaconDay));

$beacon([['optin_id' => $unpublished->id, 'kind' => 'impression']]);

$verify->check(
    'an Optin that is not in the published set counts nothing',
    null,
    $countOf($unpublished->id, 'impression', $beaconDay)
);

$beacon([['optin_id' => $published->id, 'kind' => 'lead_magnet_delivered']]);

$verify->check(
    'a browser cannot assert a delivery it never saw',
    null,
    $countOf($published->id, 'lead_magnet_delivered', $beaconDay)
);

$beacon([['optin_id' => $published->id, 'kind' => 'scrolled_past']]);

$verify->check('an unknown kind counts nothing', null, $countOf($published->id, 'scrolled_past', $beaconDay));

$before = $countOf($published->id, 'impression', $beaconDay);

$verify->check(
    'a prefetch is accepted and counts nothing',
    204,
    $beacon([['optin_id' => $published->id, 'kind' => 'impression']], ['sec-purpose' => 'prefetch;prerender'])
);
$verify->check('the prefetch really counted nothing', $before, $countOf($published->id, 'impression', $beaconDay));

$beacon(
    [['optin_id' => $published->id, 'kind' => 'impression']],
    ['user-agent' => 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)']
);

$verify->check('a bot that names itself counts nothing either', $before, $countOf($published->id, 'impression', $beaconDay));

// **And a request with NO user agent is counted.** Dropping it would be a
// heuristic, and one that fails in the expensive direction: a visitor behind a
// UA-stripping extension is a real person, and a missing Impression removes a
// denominator and flatters conversion rate permanently.
$beacon([['optin_id' => $published->id, 'kind' => 'impression']], ['user-agent' => '']);

$verify->check(
    'a request with no user agent is counted rather than guessed at',
    ($before ?? 0) + 1,
    $countOf($published->id, 'impression', $beaconDay)
);

echo "The rate limit\n";

$limited = $optins->create('Rate limit check', 'grow_email_list', []);
$optins->publish($limited->id);

// A SECOND address, with an allowance of its own. The checks above spent a
// handful of the first one's — the limit is per caller and per minute across
// every beacon request, not per Optin — so counting from 60 here would be
// counting from a number this script had already moved.
$_SERVER['REMOTE_ADDR'] = '198.51.100.7';

$statuses = [];

// Read off the class rather than restated. The ceiling is sized against
// LEGITIMATE traffic — a page carrying an overlay and a few inline Optins costs
// three to five requests plus a flush — so it is a number that will move, and a
// copy of it here would be a second spelling to keep in step.
$allowed = RateLimit::ALLOWED;

for ($i = 0; $i <= $allowed; $i++) {
    $statuses[] = $beacon([['optin_id' => $limited->id, 'kind' => 'impression']]);
}

$verify->check(
    'every request inside the allowance is accepted',
    [204],
    array_values(array_unique(array_slice($statuses, 0, $allowed)))
);
$verify->check('the one past it is refused', 429, $statuses[$allowed]);
$verify->check('and the refused one counted nothing', $allowed, $countOf($limited->id, 'impression', $beaconDay));

// One noisy caller must not silence anybody else, or a single address would
// take a merchant's whole day of numbers with it.
$_SERVER['REMOTE_ADDR'] = '203.0.113.42';

$beforeCrossCheck = $countOf($published->id, 'impression', $beaconDay);

$beacon([['optin_id' => $published->id, 'kind' => 'impression']]);

$verify->check(
    "one caller cannot spend another's allowance",
    ($beforeCrossCheck ?? 0) + 1,
    $countOf($published->id, 'impression', $beaconDay)
);

// **Neither address is anywhere in the options table**, key or value. The
// bucket is `wp_hash()` of the address, which is an HMAC on the site's own
// salts — irreversible, and uncorrelatable across sites (ADR 0006, issue #11).
$verify->check('no address was stored anywhere, in a key or in a value', 0, (int) $wpdb->get_var($wpdb->prepare(
    "SELECT COUNT(*) FROM `{$wpdb->options}` WHERE option_name LIKE %s OR option_name LIKE %s"
        . " OR option_value LIKE %s OR option_value LIKE %s",
    '%203.0.113.42%',
    '%198.51.100.7%',
    '%203.0.113.42%',
    '%198.51.100.7%'
)));

echo "The milestones\n";

// ==========================================================================
// FOUR OF THE FIVE ARE A DATE RECORDED ONCE (#94).
// ==========================================================================
// Two of them are `MIN(stat_date)` over the counters, which is an AGGREGATE —
// a result set that exists nowhere in the table, so a fake modelling the table
// cannot answer it and `tests/unit/Milestone/FirstDaysAreAMinimumTest.php`
// deliberately does not try. It proves the statement issued; this proves the
// statement.
//
// The rows above already span several days across several kinds, so the
// minimum is a real minimum rather than the only row there is.
$statDays = $wpdb->get_results("SELECT kind, MIN(stat_date) AS first_day FROM `{$statsTable}` GROUP BY kind", ARRAY_A);
$expectedFirsts = [];

foreach (is_array($statDays) ? $statDays : [] as $row) {
    $expectedFirsts[(string) $row['kind']] = (string) $row['first_day'];
}

$verify->check('the first day of each kind is the minimum MySQL reports', $expectedFirsts, $stats->firstDays());

// **It is the EARLIEST and not the latest, asserted from the other side.** A
// `MIN` mistyped as a `MAX` would agree with the check above, because that one
// reads the same statement back.
$earliestImpression = (string) $wpdb->get_var(
    "SELECT MIN(stat_date) FROM `{$statsTable}` WHERE kind = 'impression'"
);
$latestImpression = (string) $wpdb->get_var(
    "SELECT MAX(stat_date) FROM `{$statsTable}` WHERE kind = 'impression'"
);

$verify->check('and the two ends of the impression history are different days', true, $earliestImpression !== $latestImpression);
$verify->check('so first-shown is the earliest of them', $earliestImpression, $stats->firstDays()['impression'] ?? null);

// ==========================================================================
// THE ACTIVATION MILESTONE, AND THE DERIVATION IT IS NOT.
// ==========================================================================
// `MIN(published_at)` is the obvious answer and it is wrong: `unpublish()`
// sets that column back to NULL, so the minimum over it moves FORWARDS the day
// a merchant takes their oldest Optin down. That is a claim about an UPDATE
// against real SQL, which is why it is checked here and not only in the suite.
$milestones = new MilestoneStore($options);

$verify->check('a site that has published nothing has no activation milestone', null, $milestones->firstPublish());

$activated = $optins->create('Activation', 'grow_email_list', ['rules' => [['type' => 'page_load']]]);

$optins->publish($activated->id);

$stamped = $milestones->firstPublish();

$verify->check('publishing stamps the day it happened', substr((string) current_time('mysql'), 0, 10), $stamped);

$optins->unpublish($activated->id);

$verify->check(
    'and unpublishing empties the column a derived milestone would have read',
    null,
    $wpdb->get_var($wpdb->prepare(
        "SELECT published_at FROM `{$wpdb->prefix}wconvert_optins` WHERE id = %s",
        $activated->id
    ))
);
$verify->check('while the milestone stands', $stamped, $milestones->firstPublish());

// **Deactivating and reactivating does not reset it**, which is one of #94's
// acceptance criteria and a claim about `Bootstrap`'s hooks rather than about
// any class. Deactivation touches no data at all (ADR 0018) and activation
// re-runs the installer, so running the installer again is the whole of what a
// reactivation does to storage.
(new Installer($options, $optins))->install();

$verify->check('reactivating does not reset a milestone that already happened', $stamped, $milestones->firstPublish());

// ==========================================================================
// AND NOTHING ABOUT A VISITOR IS ANYWHERE IN WHAT WAS STORED.
// ==========================================================================
// The same shape as the address check below: read the option back out of the
// real options table and look at what is IN it, rather than asserting that
// some sender was not called. Two days, a [[Playbook]] id and one of five
// words is the whole of it (ADR 0017).
$storedMilestones = (string) $wpdb->get_var($wpdb->prepare(
    "SELECT option_value FROM `{$wpdb->options}` WHERE option_name = %s",
    MilestoneStore::OPTION
));

$verify->check('the milestone option is one row and it is not autoloaded', 'off', (string) $wpdb->get_var($wpdb->prepare(
    "SELECT autoload FROM `{$wpdb->options}` WHERE option_name = %s",
    MilestoneStore::OPTION
)));

foreach (['optin_id', 'user', 'ip', 'REMOTE_ADDR', $activated->id] as $absent) {
    $verify->check(
        "no {$absent} is anywhere in the stored milestones",
        false,
        str_contains($storedMilestones, (string) $absent)
    );
}

// The read model, over the real stores. `configured` is false because this
// script binds no Destination — which is the state a site with no Destination
// should report rather than being held one step short forever.
$reached = (new Milestones(
    $milestones,
    $stats,
    new HealthStore($options),
    new DestinationStore($options)
))->read();

$verify->check('the screen reads the day that was stamped', $stamped, $reached['first_publish'] ?? null);
$verify->check('and the earliest impression MySQL holds', $earliestImpression, $reached['first_impression'] ?? null);
$verify->check(
    'and says a site with no Destination has none rather than being stuck',
    ['configured' => false, 'landed' => false, 'failing' => false],
    $reached['destinations'] ?? null
);

echo "Cleaning up\n";

$wpdb->query("DELETE FROM `{$statsTable}`");

delete_option(MilestoneStore::OPTION);

foreach (
    [$published->id, $unpublished->id, $limited->id, $reported->id, $tidied->id, $zoned->id, $activated->id]
    as $id
) {
    $wpdb->query($wpdb->prepare("DELETE FROM `{$wpdb->prefix}wconvert_optins` WHERE id = %s", $id));
}

// The published set is derived state rebuilt on write, so it has to be told —
// the two Optins it points at have just stopped existing (ADR 0003).
(new PublishedSet($options))->replaceWith([]);

// Every rate-limit bucket this script opened. They would expire on their own
// within the minute; removing them means the script leaves nothing behind.
$wpdb->query($wpdb->prepare(
    "DELETE FROM `{$wpdb->options}` WHERE option_name LIKE %s",
    '%transient%wconvert_beacon_%'
));

unset($_SERVER['REMOTE_ADDR']);

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
