<?php

defined('ABSPATH') || exit;

return [
    'id' => 'specification-sheet',
    'name' => __('Help shoppers compare two sizes', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'specification-sheet',
    'business_types' => ['stores'],
    'notes' => __('Replace the sample dimensions and care details with real product facts. Set the product comparison link and target relevant product pages. No sale is counted by this setup.', 'wconvert'),
    'copy' => [
        'headline' => __('Which table fits your space?', 'wconvert'),
        'body' => [__('Two everyday options. Start with the space beside your seat.', 'wconvert'), __('Small · 35 × 35 cm', 'wconvert'), __('Wide · 50 × 40 cm', 'wconvert'), __('Small · an armchair', 'wconvert'), __('Wide · a two-seat sofa', 'wconvert'), __('Small · wipe clean', 'wconvert'), __('Wide · wipe clean', 'wconvert')],
        'eyebrow' => [__('Footprint', 'wconvert'), __('Best beside', 'wconvert'), __('Care', 'wconvert')],
        'cta_label' => __('Explore the tables', 'wconvert'),
        'fine_print' => __('Check the product pages for materials, price and availability.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
