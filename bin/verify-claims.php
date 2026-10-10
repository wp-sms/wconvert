<?php

/**
 * verify-claims.php — Pro's short-lived claims, against a real database.
 *
 *     wp eval-file bin/verify-claims.php --use-include   # Pro active
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * WHY THIS EXISTS. A claim is `add_option()` plus one shared sweep, and both
 * halves are WordPress and SQL: the uniqueness `add_option()` gives, the cron
 * entry it does or does not add, and a `DELETE` ranged over `option_id`. Each
 * claim used to schedule its own expiry, and under twenty concurrent writers
 * half of those entries were lost to the `cron` option's read-modify-write,
 * leaving their claims behind forever (ADR 0141). So the claim this makes is
 * the shape of the cron array, not the arithmetic.
 *
 * IT REFUSES TO RUN WHERE CLAIMS ALREADY EXIST. The sweep is driven by hand
 * here, with a mark pushed forward to stand in for an hour passing, so a real
 * shopper's live claim would be swept early.
 */

declare(strict_types=1);

use WConvert\Pro\Claims;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-claims.php --use-include\n");

    exit(2);
}

/** The checks, and what failed — an object for the reason `bin/verify-lead-log.php` gives. */
final class ClaimsVerification
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

if (!class_exists(Claims::class)) {
    fwrite(STDERR, "WConvert Pro is not active; there are no claims to verify.\n");

    exit(2);
}

global $wpdb;

/** Every claim row in the table. */
$claimRows = static function () use ($wpdb): int {
    return count(array_filter((array) $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wconvert\\_%\\_claim\\_%'"),
        static fn ($name): bool => is_string($name) && preg_match('/^wconvert_(order|cart)_claim_[a-f0-9]{64}$/D', $name) === 1));
};

/** How many cron entries carry a hook. */
$entries = static function (string $hook): int {
    $count = 0;
    foreach ((array) _get_cron_array() as $hooks) {
        $count += is_array($hooks) && isset($hooks[$hook]) ? count($hooks[$hook]) : 0;
    }

    return $count;
};

if ($claimRows() > 0) {
    fwrite(STDERR, "This site holds live claims; run this on a throwaway WordPress instead.\n");

    exit(2);
}

$verify = new ClaimsVerification();
$name = static fn (string $kind): string => "wconvert_{$kind}_claim_" . hash('sha256', random_bytes(16));
wp_unschedule_hook(Claims::HOOK);
delete_option(Claims::MARK);

echo "Taking claims\n";

$first = $name('order');
$verify->check('a fresh claim is taken', true, Claims::take($first, time()));
$verify->check('the same claim is refused the second time', false, Claims::take($first, time()));

$taken = [$first];
for ($i = 0; $i < 49; $i++) {
    $taken[] = $claim = $name($i % 2 === 0 ? 'order' : 'cart');
    Claims::take($claim, ['state' => 'unknown']);
}

$verify->check('fifty claims are fifty rows', 50, $claimRows());
$verify->check('and one sweep, however many claims', 1, $entries(Claims::HOOK));
$verify->check('with no per-claim expiry entries', 0, $entries('wconvert_attribution_claim_expired') + $entries('wconvert_cart_claim_expired'));

echo "Sweeping\n";

// What WP-Cron does: the event leaves the array, then its hook runs.
$cronRun = static function (): void {
    wp_unschedule_hook(Claims::HOOK);
    do_action(Claims::HOOK);
};

// A row that only resembles a claim, and an unrelated one, both older than the mark.
add_option('wconvert_cart_claim_settings', 'keep', '', false);
add_option('wconvert_verify_claims_neighbour', 'keep', '', false);
$decoys = ['wconvert_cart_claim_settings', 'wconvert_verify_claims_neighbour'];

// The mark was taken with the first claim, so the other forty-nine are newer than it.
$cronRun();
$verify->check('a sweep removes nothing taken after its mark', 49, $claimRows());
$verify->check('and schedules the next one', 1, $entries(Claims::HOOK));

// A claim taken while that sweep is pending is newer than its mark.
$late = $name('cart');
Claims::take($late, ['state' => 'counted']);
$verify->check('a claim taken while a sweep is pending adds no entry', 1, $entries(Claims::HOOK));
$cronRun();

$verify->check('a sweep removes every claim at or below its mark', 1, $claimRows());
$verify->check('the claim taken after the mark survives', true, get_option($late) !== false);
$verify->check('what only looks like a claim survives', 'keep', get_option('wconvert_cart_claim_settings'));
$verify->check('an unrelated option survives', 'keep', get_option('wconvert_verify_claims_neighbour'));
$verify->check('a swept claim can no longer be read', false, get_option($taken[10]));

$cronRun();

$verify->check('with nothing left to sweep there is no claim row', 0, $claimRows());
$verify->check('no sweep stays scheduled', 0, $entries(Claims::HOOK));
$verify->check('and no mark is left behind', false, get_option(Claims::MARK));

echo "Cleaning up\n";
foreach ($decoys as $decoy) delete_option($decoy);

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";
