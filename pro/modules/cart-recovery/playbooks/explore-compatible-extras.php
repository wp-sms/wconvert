<?php
defined('ABSPATH') || exit;
return [
    'id' => 'explore-compatible-extras',
    'name' => __('Explore useful product accessories', 'wconvert'),
    'business_types' => ['stores'],
    'goal' => 'promote_offer',
    'template_id' => 'accessory-workbench',
    'notes' => __('Choose the main product and verify that each accessory fits it. Place beside its product details; on block themes, use the campaign block or shortcode. Product clicks are counted, not purchases.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('A considered pairing', 'wconvert'),
        'headline' => __('Make more of your everyday kit.', 'wconvert'),
        'body' => __('Explore useful extras before you choose.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
