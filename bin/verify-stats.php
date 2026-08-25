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
 * are not something to be careful around. They are something to refuse.
 */

declare(strict_types=1);

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatDay;
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

(new Installer($options))->install();

$statsTable = $wpdb->prefix . Connection::TABLE_STATS;

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$statsTable}`") !== 0) {
    fwrite(STDERR, "{$statsTable} is not empty. The counters cannot be recomputed, so this refuses to touch "
        . "a site that already has some — boot a throwaway WordPress instead (see README.md).\n");

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

echo "The beacon endpoint\n";

// `rest_do_request()` builds a real request, runs the permission callback and
// dispatches to the real route — everything an HTTP call would do except the
// socket. Nothing else can prove the controller wires its three collaborators
// together, because a `WP_REST_Request` faithful enough to prove it is a
// WordPress install with extra steps.
$optins = new OptinRepository($db, new PublishedSet($options), RuleVocabulary::fromManifest());
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

$verify->check('a bot counts nothing either', $before, $countOf($published->id, 'impression', $beaconDay));

echo "The rate limit\n";

$limited = $optins->create('Rate limit check', 'grow_email_list', []);
$optins->publish($limited->id);

// A SECOND address, with an allowance of its own. The checks above spent a
// handful of the first one's — the limit is per caller and per minute across
// every beacon request, not per Optin — so counting from 60 here would be
// counting from a number this script had already moved.
$_SERVER['REMOTE_ADDR'] = '198.51.100.7';

$statuses = [];

// The ceiling is 60 a minute per address. The 61st is the one being asserted;
// everything before it is an allowance a real visitor never comes near — a page
// view is one Impression plus one flush.
for ($i = 0; $i < 61; $i++) {
    $statuses[] = $beacon([['optin_id' => $limited->id, 'kind' => 'impression']]);
}

$verify->check(
    'every request inside the allowance is accepted',
    [204],
    array_values(array_unique(array_slice($statuses, 0, 60)))
);
$verify->check('the one past it is refused', 429, $statuses[60]);
$verify->check('and the refused one counted nothing', 60, $countOf($limited->id, 'impression', $beaconDay));

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

echo "Cleaning up\n";

$wpdb->query("DELETE FROM `{$statsTable}`");

foreach ([$published->id, $unpublished->id, $limited->id] as $id) {
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
