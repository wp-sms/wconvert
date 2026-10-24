<?php
/** Optional local theme fonts on the disposable WordPress review site. Never packaged. */
add_filter('wp_theme_json_data_theme', static function ($theme) {
    if (!isset($_GET['wconvert_review_fonts']) || !defined('WCONVERT_DS_SECRET') || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) return $theme;
    $base = plugins_url('tools/design-library/assets/fonts/', WCONVERT_DIR . 'wconvert.php');
    return $theme->update_with(['version' => 3, 'settings' => ['typography' => ['fontFamilies' => [
        ['name' => 'DM Sans', 'slug' => 'review-dm-sans', 'fontFamily' => '"DM Sans", Arial, sans-serif', 'fontFace' => [
            ['fontFamily' => 'DM Sans', 'fontWeight' => '400', 'fontStyle' => 'normal', 'src' => [$base . 'dm-sans-400.ttf']],
            ['fontFamily' => 'DM Sans', 'fontWeight' => '700', 'fontStyle' => 'normal', 'src' => [$base . 'dm-sans-700.ttf']],
        ]],
        ['name' => 'Bebas Neue', 'slug' => 'review-bebas-neue', 'fontFamily' => '"Bebas Neue", Impact, sans-serif', 'fontFace' => [
            ['fontFamily' => 'Bebas Neue', 'fontWeight' => '400', 'fontStyle' => 'normal', 'src' => [$base . 'bebas-neue-400.woff2']],
        ]],
        ['name' => 'Cormorant Garamond', 'slug' => 'review-cormorant', 'fontFamily' => '"Cormorant Garamond", Georgia, serif', 'fontFace' => [
            ['fontFamily' => 'Cormorant Garamond', 'fontWeight' => '400', 'fontStyle' => 'normal', 'src' => [$base . 'cormorant-garamond.woff2']],
        ]],
        ['name' => 'Instrument Serif', 'slug' => 'review-instrument-serif', 'fontFamily' => '"Instrument Serif", Georgia, serif', 'fontFace' => [
            ['fontFamily' => 'Instrument Serif', 'fontWeight' => '400', 'fontStyle' => 'normal', 'src' => [$base . 'instrument-serif-400.ttf']],
        ]],
    ]]]]);
});
