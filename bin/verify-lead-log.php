<?php

/**
 * verify-lead-log.php — the lead log's SQL, against a real database.
 *
 *     wp eval-file bin/verify-lead-log.php --use-include
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * WHY THIS EXISTS AND A UNIT TEST DOES NOT DO IT. `tests/unit/Lead/` proves
 * the mapping, the ordering and the statements issued, against a fake that
 * models the TABLE and ignores the query text — deliberately, because a fake
 * that re-implemented `GROUP BY` would make itself the authority on what SQL
 * does, and the tests would then agree with the fake rather than with a
 * database. So the one claim they cannot make is the one this makes: that two
 * rows sharing a canonical identifier really do collapse, that the union of
 * two aggregates really is the whole table, and that a range over the primary
 * key really does name the rows a `created_at` range would (ADR 0033).
 *
 * IT REFUSES TO RUN ON A LOG THAT ALREADY HAS LEADS IN IT. Two of the checks
 * are deletes over the whole table — that is what a retention prune IS — so
 * pointing this at an install with real captures would destroy them. Boot a
 * throwaway WordPress instead; README.md has the one-liner.
 */

declare(strict_types=1);

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Destination\DeliveryFailures;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadRepository;
use WConvert\Lead\Submission;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Privacy\LeadEraser;
use WConvert\Privacy\LeadErasure;
use WConvert\Retention\LeadPruner;
use WConvert\Retention\RetentionPeriod;
use WConvert\Rules\RuleVocabulary;
use WConvert\Storage\WpOptionStore;
use WConvert\Support\Ulid;
use WConvert\Template\TemplateVocabulary;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-lead-log.php --use-include\n");

    exit(2);
}

/**
 * The checks, and what failed.
 *
 * A tiny object rather than a function over a global: this file is analysed at
 * PHPStan level 7 like everything else in `bin/`, and a global mutated inside a
 * function is a value static analysis cannot follow — so the exit code below
 * would be provably unreachable rather than merely correct.
 */
final class LeadLogVerification
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

$verify = new LeadLogVerification();

global $wpdb;

$options = new WpOptionStore();
$db = new WpdbConnection($wpdb);

// The Optin repository, hoisted above the install because the installer now
// takes one: `install()` rebuilds the published set, which is the one piece of
// WConvert's derived state nothing rewrites on its own (ADR 0003). It is the
// same object the CSV export check uses further down.
$optins = new OptinRepository($db, new PublishedSet($options), RuleVocabulary::fromManifest(), new MilestoneStore($options));

(new Installer($options, $optins))->install();

$leadTable = $wpdb->prefix . Connection::TABLE_LEADS;

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`") !== 0) {
    fwrite(STDERR, "{$leadTable} is not empty. Two of these checks delete over the whole table — "
        . "boot a throwaway WordPress instead (see README.md).\n");

    exit(2);
}

$leads = new LeadRepository($db);
$log = new LeadLog($leads);
$optinId = Ulid::generate();
$otherOptinId = Ulid::generate();

echo "Writing the fixture\n";

// Sarah, twice, into one Optin. Bob once, into the other. And a phone-only
// capture, which is the row the second half of the union exists for.
$sarahFirst = $leads->record($optinId, new Submission('sarah@example.com', null, ['name' => 'Sarah']));
$bob = $leads->record($otherOptinId, new Submission('bob@example.com', '+442071234567', []));
$phoneOnly = $leads->record($optinId, new Submission(null, '+12025551234', ['consent_text' => 'Email me offers.']));
$sarahSecond = $leads->record($optinId, new Submission('sarah@example.com', null, []));

// Paging intentionally excludes the current millisecond. Let the final fixture
// enter that window before comparing grouped and ungrouped reads.
usleep(2000);

echo "The grouping view\n";

$grouped = $log->read(null, true, 50);
$identifiers = array_column($grouped['groups'], 'submissions', 'identifier');

$verify->check('the headline is four submissions', 4, $grouped['submissions']);
$verify->check("sarah's two rows collapse to one group of two", 2, $identifiers['sarah@example.com'] ?? null);
$verify->check('bob is a group of one', 1, $identifiers['bob@example.com'] ?? null);
$verify->check('a phone-only capture is a group of its own', 1, $identifiers['+12025551234'] ?? null);
$verify->check('every row is in exactly one group', 4, array_sum($identifiers));
$verify->check('bob is grouped by his email, not counted twice for his phone', null, $identifiers['+442071234567'] ?? null);

$ungrouped = $log->read(null, false, 50);

$verify->check('the toggle does not move the headline', $grouped['submissions'], $ungrouped['submissions']);
$verify->check('the log reads newest first', $sarahSecond->id, $ungrouped['leads'][0]['id'] ?? null);

$forOptin = $log->read($optinId, false, 50);

$verify->check('filtering to one optin counts only its leads', 3, $forOptin['submissions']);

// **The per-Optin GROUPED read**, which is the query the `%i` binding bug hid
// in: it names the table twice, and only this combination interleaves the
// table with a value. A fake that ignores SQL text cannot see it, and reading
// the log unfiltered does not reach it.
$groupedForOptin = $log->read($optinId, true, 50);
$forOptinIdentifiers = array_column($groupedForOptin['groups'], 'submissions', 'identifier');

$verify->check('grouping one optin still collapses its shared identifier', 2, $forOptinIdentifiers['sarah@example.com'] ?? null);
$verify->check("and does not reach the other optin's leads", null, $forOptinIdentifiers['bob@example.com'] ?? null);
$verify->check('and its headline is that optin\'s submissions', 3, $groupedForOptin['submissions']);
$verify->check('the grouped query ran at all', '', (string) $wpdb->last_error);

$group = null;

foreach ($grouped['groups'] as $candidate) {
    if ($candidate['identifier'] === 'sarah@example.com') {
        $group = $candidate;
    }
}

$verify->check("a group's latest id is its newest lead", $sarahSecond->id, $group['latest_id'] ?? null);

echo "The CSV export\n";

$optins->create('Newsletter footer', 'grow_email_list', []);
$named = array_key_first($optins->names());
$csv = new LeadCsv(TemplateVocabulary::fromManifest());
$handle = fopen('php://memory', 'r+');

if ($handle === false) {
    fwrite(STDERR, "Could not open a memory stream to write the export into.\n");

    exit(2);
}

$csv->writeHeader($handle);
$csv->writeRows($handle, $leads->page(null, 50), $optins->names());
rewind($handle);
$file = (string) stream_get_contents($handle);
fclose($handle);

$verify->check('the export names its columns from the vocabulary', true, str_contains($file, 'consent_text'));
$verify->check('the export carries the consent record as shown', true, str_contains($file, 'Email me offers.'));
$verify->check('an e164 phone cannot be run as a spreadsheet formula', true, str_contains($file, "'+12025551234"));
$verify->check('a soft-deleted optin still supplies its name', true, $optins->delete((string) $named) && isset($optins->names()[(string) $named]));

echo "Erasure\n";

$leadErasure = new LeadErasure($leads, new DeliveryFailures($options));
$eraser = new LeadEraser($leadErasure);
$result = $eraser->erase('sarah@example.com');

$verify->check('erasure reports rows removed', true, $result['items_removed']);
$verify->check('erasure retains nothing', false, $result['items_retained']);
$verify->check('erasure finishes in one pass', true, $result['done']);
$verify->check('no row carrying that address survives', 0, (int) $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM `{$leadTable}` WHERE email = %s", 'sarah@example.com')
));
$verify->check('nothing else was touched', 2, (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`"));
$verify->check('and the erased ids are gone rather than blanked', 0, (int) $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM `{$leadTable}` WHERE id IN (%s, %s)", $sarahFirst->id, $sarahSecond->id)
));
$phoneResult = $leadErasure->erase('+1 202 555 1234');
$verify->check('an exact phone erasure reports its direct match', 1, $phoneResult['removed'] ?? null);
$verify->check('no row carrying that phone survives', 0, (int) $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM `{$leadTable}` WHERE phone = %s", '+12025551234')
));
$verify->check('phone erasure does not take a row carrying another phone', 1, (int) $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM `{$leadTable}` WHERE id = %s", $bob->id)
));

echo "The retention prune\n";

$retention = new RetentionPeriod($options);
$pruner = new LeadPruner($leads, $retention);

$verify->check('with no period configured it removes nothing', 0, $pruner->run());
$verify->check('and the log is untouched', 1, (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`"));

// A capture that happened sixty days ago, INSERTED rather than aged by an
// UPDATE. Rewriting a row's id would have been the quick way, and it is the
// one thing no file in this repository may do — a Lead has no update path, and
// `tests/unit/Lead/NoLeadIsEverUpdatedTest.php` reads `bin/` for exactly that.
// An insert is the only write a Lead ever takes, which is what makes this an
// honest fixture rather than a workaround.
$aged = Ulid::floorAt((int) floor(microtime(true) * 1000) - (60 * 86400000));

$db->insert(Connection::TABLE_LEADS, [
    'id' => $aged,
    'optin_id' => $otherOptinId,
    'email' => 'long.ago@example.com',
    'phone' => null,
    'fields' => '{}',
    'created_at' => gmdate('Y-m-d H:i:s', time() - (60 * 86400)),
]);

$retention->set(30);

$verify->check('the aged capture is in the log before the prune', 2, (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`"));
$verify->check('a configured period removes what has outlived it', 1, $pruner->run());
$verify->check('and leaves what has not', 1, (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`"));
$verify->check('nothing recent was taken with it', 0, (int) $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM `{$leadTable}` WHERE id = %s", $aged)
));

echo "Cleaning up\n";

// `delete_option` rather than `set(null)`: keep-forever is the ABSENCE of a
// period, and leaving a stored 0 behind would mean this script had configured
// something on an install it was only supposed to read.
delete_option(RetentionPeriod::OPTION);
$wpdb->query("DELETE FROM `{$leadTable}`");
$wpdb->query($wpdb->prepare("DELETE FROM `{$wpdb->prefix}wconvert_optins` WHERE id = %s", (string) $named));

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
