<?php

/**
 * verify-content-region.php — the content lock's markup, through the real kses.
 *
 * Exit 0 = every check passed, 1 = a check failed.
 *
 * WHY THIS EXISTS AND A UNIT TEST DOES NOT DO IT. The second WordPress.org
 * review (October 2026) asked for the `wconvert_content_region_html` filter's
 * result to be escaped before it is returned. That only works if WordPress's
 * own `wp_kses()` keeps the region's markup: the `data-wconvert-*` attributes
 * (one of them without a value) and the inline anchor. `data-*` is a global
 * kses attribute since WordPress 5.0, and this proves it on a real WordPress
 * rather than trusting a stub in tests/bootstrap.php.
 *
 * Runs on Playground's SQLite (see README, "Running a bin/verify-*.php script
 * under Playground"): mount an mu-plugin that requires wconvert.php, then
 * `require` this file after wp-load.php.
 */

defined('ABSPATH') || exit(2);

use WConvert\Frontend\ContentRegion;

$id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
$failed = 0;
$check = static function (string $name, bool $ok) use (&$failed): void {
    echo ($ok ? 'PASS ' : 'FAIL ') . $name . "\n";
    $failed += $ok ? 0 : 1;
};

$html = ContentRegion::html($id, '<p>Bonus <strong>text</strong></p><iframe src="https://www.youtube.com/embed/x" allowfullscreen></iframe><script>alert(1)</script>');
echo $html . "\n";
$check('region attribute kept', str_contains($html, 'data-wconvert-region="' . $id . '"'));
$check('valueless locked-content attribute kept', str_contains($html, 'data-wconvert-locked-content'));
$check('region class kept', str_contains($html, 'class="wconvert-content-region"'));
$check('inline anchor kept', str_contains($html, 'data-wconvert-optin="' . $id . '"'));
$check('iframe kept', str_contains($html, '<iframe src="https://www.youtube.com/embed/x"'));
$check('script removed', !str_contains($html, '<script'));

// Pro's content lock renames one attribute in the filter.
$rename = static fn (string $markup): string => str_replace('data-wconvert-region=', 'data-wconvert-content-lock=', $markup);
add_filter('wconvert_content_region_html', $rename);
$html = ContentRegion::html($id, '<p>Bonus</p>');
remove_filter('wconvert_content_region_html', $rename);
$check('Pro rename kept', str_contains($html, 'data-wconvert-content-lock="' . $id . '"'));

// Whatever a filter adds is escaped too.
$inject = static fn (string $markup): string => $markup . '<script>alert(2)</script><div onclick="alert(3)">x</div>';
add_filter('wconvert_content_region_html', $inject);
$html = ContentRegion::html($id, '<p>Bonus</p>');
$short = do_shortcode('[' . ContentRegion::SHORTCODE . ' id="' . $id . '"]<p>Bonus</p>[/' . ContentRegion::SHORTCODE . ']');
remove_filter('wconvert_content_region_html', $inject);
$check('filtered script removed (block)', !str_contains($html, '<script') && !str_contains($html, 'onclick'));
$check('filtered script removed (shortcode)', !str_contains($short, '<script') && !str_contains($short, 'onclick') && str_contains($short, 'data-wconvert-locked-content'));

echo $failed === 0 ? "OK\n" : "FAILED: {$failed}\n";
exit($failed === 0 ? 0 : 1);
