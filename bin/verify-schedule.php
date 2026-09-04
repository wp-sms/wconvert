<?php

/**
 * verify-schedule.php — the schedule, against a real WordPress clock.
 *
 *     wp eval-file bin/verify-schedule.php
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * ============================================================================
 * WHY THIS EXISTS AND A UNIT TEST DOES NOT DO IT.
 * ============================================================================
 * `tests/bootstrap.php` answers `wp_timezone()` as though the site were on UTC,
 * deliberately and consistently with its other clock stubs — so a test written
 * against it cannot tell the site's zone from UTC's and would pass just as
 * happily against code that read the wrong one.
 * {@see \WConvert\Stats\StatDay} states that rule and
 * `bin/verify-stats.php` is where its one WordPress-facing line is proven; this
 * is the same arrangement for {@see \WConvert\Optin\Schedule}.
 *
 * The claims that need a real install, and that nothing else can make:
 *
 * - **`wp_timezone()` is read at every rebuild**, so a merchant who corrects
 *   their site's timezone corrects every schedule with it. The unit tests pass
 *   a zone in; only a real `timezone_string` proves the wiring reads one.
 * - **The window survives into the published option as two integers.** A wall
 *   time reaching the browser would make one schedule mean a different moment
 *   in every visitor's browser, and the JSON in `wp_options` is where that is
 *   visible.
 * - **A not-yet-started Optin is IN the option.** This is the assertion the
 *   whole feature turns on (ADR 0050): the set is rebuilt on write and never on
 *   a timer, so an Optin held back from it never reaches the cached page its
 *   window was supposed to open on.
 * - **A backwards schedule is refused by the REST route**, through WordPress's
 *   own request machinery rather than a hand-built object.
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
use WConvert\Frontend\InspectorSchedules;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\InvalidSchedule;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\Schedule;
use WConvert\Rules\RuleVocabulary;
use WConvert\Storage\WpOptionStore;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-schedule.php\n");

    exit(2);
}

/**
 * The checks, and what failed.
 *
 * A tiny object rather than a global, for `bin/verify-lead-log.php`'s reason:
 * `bin/` is analysed at PHPStan level 7 like everything else, and a global
 * mutated inside a function is a value static analysis cannot follow.
 */
final class ScheduleVerification
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

$verify = new ScheduleVerification();

global $wpdb;

$options = new WpOptionStore();
$db = new WpdbConnection($wpdb);
$optins = new OptinRepository($db, new PublishedSet($options), RuleVocabulary::fromManifest(), new MilestoneStore($options));

(new Installer($options, $optins))->install();

$optinTable = $wpdb->prefix . Connection::TABLE_OPTINS;

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$optinTable}`") !== 0) {
    fwrite(STDERR, "{$optinTable} is not empty. This writes Optins and rebuilds the published set, which is a "
        . "live site's front end — boot a throwaway WordPress instead (see README.md).\n");

    exit(2);
}

$set = new PublishedSet($options);
$originalZone = get_option('timezone_string');
$originalOffset = get_option('gmt_offset');

/** One entry of the published option, by id. */
$entryFor = static function (string $id) use ($set): ?array {
    foreach ($set->all() as $entry) {
        if (($entry['id'] ?? null) === $id) {
            return $entry;
        }
    }

    return null;
};

/**
 * Set the site's timezone exactly the way the Settings screen does — and
 * REBUILD NOTHING BY HAND.
 *
 * That is the half the acceptance criterion turns on. The published set is
 * derived state rebuilt on WRITE (ADR 0003) and a timezone change is not a
 * write to any Optin, so `CoreServiceProvider` hooks
 * `update_option_timezone_string` and `update_option_gmt_offset` to rebuild
 * it. A script that called the rebuild itself would pass with that hook
 * deleted, which is the one thing this check exists to catch.
 */
$retimezone = static function (string $zone): void {
    update_option('timezone_string', $zone);
    update_option('gmt_offset', '');
};

echo "\nThe site's own timezone, read at every rebuild\n";

// A half-hour offset zone, which is where "add the offset" implementations
// come apart, and one with a DST history so the second half of this is real.
$retimezone('Asia/Kolkata');

$sale = $optins->create('Black Friday', 'promote_offer', [
    'rules' => [['type' => 'page_load']],
    'display_type' => 'popup',
    // Far enough ahead that "not started" is not a race with the clock.
    'starts_at' => '2099-11-27 09:00',
    'ends_at' => '2099-11-30 23:59',
]);

$optins->publish($sale->id);

$kolkata = $entryFor($sale->id);

$verify->check(
    'a not-yet-started Optin is IN the published set (ADR 0050)',
    true,
    $kolkata !== null
);

$verify->check(
    'the authored wall time resolves through a half-hour offset zone',
    strtotime('2099-11-27T03:30:00+00:00') * 1000,
    $kolkata['payload']['starts_at'] ?? null
);

$verify->check(
    'the payload carries an instant and never the wall time',
    false,
    str_contains((string) json_encode($kolkata), '2099-11-27 09:00')
);

$verify->check(
    'both boundaries travel',
    strtotime('2099-11-30T18:29:00+00:00') * 1000,
    $kolkata['payload']['ends_at'] ?? null
);

// ============================================================================
// AND CHANGING IT RE-RESOLVES, WHICH IS THE WHOLE REASON THE WALL TIME IS WHAT
// IS STORED.
// ============================================================================
$retimezone('America/New_York');

$newYork = $entryFor($sale->id);

$verify->check(
    'changing the site timezone re-resolves the instant on the next rebuild',
    strtotime('2099-11-27T14:00:00+00:00') * 1000,
    $newYork['payload']['starts_at'] ?? null
);

$verify->check(
    'and nothing about the stored Optin changed to do it',
    '2099-11-27 09:00',
    $optins->find($sale->id)?->publishedConfig['starts_at'] ?? null
);

echo "\nA window that has closed\n";

$over = $optins->create('Last summer', 'promote_offer', [
    'rules' => [['type' => 'page_load']],
    'display_type' => 'popup',
    'starts_at' => '2020-06-01 00:00',
    'ends_at' => '2020-09-01 00:00',
]);

$optins->publish($over->id);

$verify->check(
    'stays in the published set until it is unpublished (ADR 0050)',
    true,
    $entryFor($over->id) !== null
);

$optins->unpublish($over->id);

$verify->check(
    'and leaves on the act that means stop',
    true,
    $entryFor($over->id) === null
);

echo "\nThe inspector's words, from the real human_time_diff()\n";

$optins->publish($over->id);

$schedules = InspectorSchedules::forSet($set->all(), (int) strtotime('2020-08-25 00:00:00 UTC'));

$verify->check(
    'a boundary already passed is still given a magnitude',
    '1 week',
    $schedules[$over->id]['ends'] ?? null
);

// Both ends of a finished campaign are behind us, and both are still minted:
// `human_time_diff()` is an absolute magnitude and the DIRECTION is the
// browser's, on the same clock reading the verdict was taken on (ADR 0050).
$verify->check(
    'and so is the other end of the same finished window',
    '3 months',
    $schedules[$over->id]['starts'] ?? null
);

$optins->unpublish($over->id);

echo "\nA site that never picked a named zone\n";

// WordPress stores those as `gmt_offset` and `wp_timezone()` hands back a
// `+05:45`-shaped zone with no name and no DST history. The arithmetic must
// not care, and only a real install produces one.
update_option('timezone_string', '');
update_option('gmt_offset', '5.75');

$verify->check(
    'a bare UTC offset resolves as well as a named zone, with nothing rebuilt by hand',
    strtotime('2099-11-27T03:15:00+00:00') * 1000,
    $entryFor($sale->id)['payload']['starts_at'] ?? null
);

echo "\nAn end before its start, refused by the route\n";

// Through WordPress's own dispatcher rather than a hand-built controller: the
// refusal has to survive `rest_do_request`, which is what an admin's browser
// actually reaches.
wp_set_current_user(1);

if (!user_can(1, 'manage_options')) {
    $administrator = get_users(['role' => 'administrator', 'number' => 1]);

    wp_set_current_user($administrator === [] ? 1 : (int) $administrator[0]->ID);
}

$request = new WP_REST_Request('POST', '/wconvert/v1/optins');
$request->set_param('name', 'Backwards');
$request->set_param('goal', 'promote_offer');
$request->set_param('config', [
    'rules' => [['type' => 'page_load']],
    'starts_at' => '2099-11-30 09:00',
    'ends_at' => '2099-11-27 09:00',
]);

$response = rest_do_request($request);

$verify->check('the route refuses it with a 400', 400, $response->get_status());

$verify->check(
    'and names the refusal rather than a generic failure',
    'wconvert_optin_invalid_schedule',
    is_array($response->get_data()) ? ($response->get_data()['code'] ?? null) : null
);

// The two this script created, and no third: a refusal that half-wrote would
// leave a draft the merchant never asked for.
$verify->check(
    'so nothing was written',
    2,
    (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$optinTable}`")
);

echo "\nThe two doors of the normaliser\n";

// The reader's door is TOTAL, and a rebuild is what would fatal without it.
$wpdb->query($wpdb->prepare(
    "UPDATE `{$optinTable}` SET published_config = %s WHERE id = %s",
    (string) json_encode([
        'display_type' => 'popup',
        'starts_at' => '2099-11-30 09:00',
        'ends_at' => '2099-11-27 09:00',
    ]),
    $sale->id
));

$optins->rebuildForInstall();

$hand_edited = $entryFor($sale->id);

$verify->check(
    'a hand-edited backwards schedule rebuilds rather than fataling',
    true,
    $hand_edited !== null
);

// FAIL SHUT, not open. The window is half-open, so a pair shipped this way
// round contains no instant and the Optin never shows — where shipping no
// window at all would read as "never scheduled" and show it forever.
$verify->check(
    'and ships the pair, so no instant is inside it',
    true,
    ($hand_edited['payload']['ends_at'] ?? 0) < ($hand_edited['payload']['starts_at'] ?? 0)
);

/** Which reason the authoring door gives, or null where it allowed the pair. */
$refusalFor = static function (array $config): ?string {
    try {
        Schedule::fromArray($config);

        return null;
    } catch (InvalidSchedule $refused) {
        return $refused->reason;
    }
};

$verify->check(
    'while the authoring door still refuses the same pair',
    InvalidSchedule::BACKWARDS,
    $refusalFor(['starts_at' => '2099-11-30 09:00', 'ends_at' => '2099-11-27 09:00'])
);

// The second refusal, and the one a dropped value would turn into a sale that
// never finishes.
$verify->check(
    'and refuses a boundary that was supplied and cannot be read',
    InvalidSchedule::UNREADABLE,
    $refusalFor(['ends_at' => 'next friday'])
);

$verify->check(
    'while an emptied box is no boundary rather than a refusal',
    null,
    $refusalFor(['starts_at' => '', 'ends_at' => ''])
);

echo "\nCleaning up\n";

foreach ([$sale->id, $over->id] as $id) {
    $wpdb->query($wpdb->prepare("DELETE FROM `{$optinTable}` WHERE id = %s", $id));
}

// Derived state rebuilt on write, so it has to be told the rows are gone.
$set->replaceWith([]);

update_option('timezone_string', $originalZone === false ? '' : $originalZone);
update_option('gmt_offset', $originalOffset === false ? '0' : $originalOffset);

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
