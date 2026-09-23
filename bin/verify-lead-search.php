<?php

/** Read-only SQL verification: wp eval-file bin/verify-lead-search.php --use-include. No fixture rows are stored. */
declare(strict_types=1);

use WConvert\Lead\LeadQuery;

if (!defined('ABSPATH')) exit(2);
global $wpdb;

// A derived relation exercises JSON extraction and literal LIKE escaping on the
// real database without inventing captures or touching the site's tables.
$fixtures = [
    ['01J0000000AAAAAAAAAAAAAAAA', '01J0000000CCCCCCCCCCCCCCCC', 'sarah@example.com', null, ['name' => 'Sarah', 'message' => 'Repair 20%_off']],
    ['01J0000000BBBBBBBBBBBBBBBB', '01J0000000DDDDDDDDDDDDDDDD', 'other@example.com', '+12025550123', ['name' => 'مینا', 'message' => "A quote\nwith a \\ path"]],
    ['01J0000000EEEEEEEEEEEEEEEE', '01J0000000CCCCCCCCCCCCCCCC', 'third@example.com', null, ['consent_text' => 'Sarah consent only']],
];
$relation = '';
$values = [];
foreach ($fixtures as $index => $row) {
    $relation .= $index === 0 ? '' : ' UNION ALL ';
    $relation .= 'SELECT %s AS id, %s AS optin_id, %s AS email, NULLIF(%s, \'\') AS phone, %s AS fields';
    array_push($values, $row[0], $row[1], $row[2], $row[3] ?? '', (string) wp_json_encode(['answers' => $row[4], 'capture' => []]));
}
$cases = [
    ['Sarah', 1], ['repair', 1], ['20%_off', 1], ['20Xoff', 0],
    ['مینا', 1], ["quote\nwith", 1], ['\\ path', 1], ['25550123', 1], ['no match', 0],
];
$failed = 0;
foreach ($cases as [$search, $expected]) {
    $filter = (new LeadQuery(search: $search))->constraints();
    // Hex-encode only the fixture's non-ASCII search values. This keeps wpdb
    // from trying to inspect a physical table named SELECT in the derived SQL.
    $predicate = str_replace('%s', 'CONVERT(UNHEX(%s) USING utf8mb4)', $filter['sql']);
    // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- literal fragments; all fixture/filter values are bound.
    $sql = $wpdb->prepare('SELECT COUNT(*) FROM (' . $relation . ') AS captures WHERE ' . $predicate, ...[...$values, ...array_map('bin2hex', $filter['params'])]);
    // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared immediately above.
    $actual = (int) $wpdb->get_var($sql);
    $ok = $actual === $expected && $wpdb->last_error === '';
    echo ($ok ? 'PASS' : 'FAIL') . ': literal captured-value search ' . wp_json_encode($search) . "\n";
    if (!$ok) $failed++;
}
if ($failed > 0) exit(1);
echo "All read-only search checks passed; no site data changed.\n";
