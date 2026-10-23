<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-all-wrapped-up',
    'name' => __('All wrapped up', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-all-wrapped-up',
    'notes' => __('Link to your seasonal gift edit or information page. Place the block or shortcode where this belongs.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('A VERY COSY CHRISTMAS', 'wconvert-pro'), 'headline' => __('All wrapped up.
Time to curl up.', 'wconvert-pro'), 'body' => __('Cosy little gifts for your favourite people. Even the ones who prefer the box.', 'wconvert-pro'), 'cta_label' => __('Find their cosy little gift', 'wconvert-pro'), 'fine_print' => ['text' => __('%i', 'wconvert-pro'), 'italic' => __('With love, from our little shop', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
