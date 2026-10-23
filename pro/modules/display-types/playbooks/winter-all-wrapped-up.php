<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-all-wrapped-up',
    'name' => __('All wrapped up', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-all-wrapped-up',
    'notes' => __('Link to your seasonal gift edit or information page. Place the block or shortcode where this belongs.', 'wconvert'),
    'copy' => ['eyebrow' => __('A VERY COSY CHRISTMAS', 'wconvert'), 'headline' => __('All wrapped up.
Time to curl up.', 'wconvert'), 'body' => __('Cosy little gifts for your favourite people. Even the ones who prefer the box.', 'wconvert'), 'cta_label' => __('Find their cosy little gift', 'wconvert'), 'fine_print' => ['text' => __('%i', 'wconvert'), 'italic' => __('With love, from our little shop', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
