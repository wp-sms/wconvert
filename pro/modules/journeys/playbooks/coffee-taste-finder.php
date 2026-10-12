<?php
defined('ABSPATH') || exit;
return [
    'id' => 'coffee-taste-finder',
    'name' => __('Find coffee by taste', 'wconvert'),
    'business_types' => ['stores'],
    'goal' => 'find_match',
    'template_id' => 'coffee-finder-board',
    'notes' => __('Choose a WooCommerce category and tasting-note attributes for every result, including the fallback. Review availability and add useful fallback links. Place on your coffee collection page. No email is requested; counts completed results.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Find your everyday coffee', 'wconvert'),
        'headline' => __('A cup that suits your taste.', 'wconvert'),
        'body' => __('Choose the flavours you enjoy. See a starting point without sharing your email.', 'wconvert'),
        'next_label' => __('See my starting point', 'wconvert'),
        'back_label' => __('Change my answer', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
