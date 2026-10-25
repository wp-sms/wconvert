<?php

defined('ABSPATH') || exit;

return [
    'id' => 'garment-fit-guide',
    'name' => __('Measure a garment before choosing a size', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'measurement-map',
    'business_types' => ['stores'],
    'notes' => __('Embed near apparel sizing. Match the diagram and instructions to the actual garment and link the correct size chart. No size recommendation is calculated.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('A BETTER FIT STARTS HERE', 'wconvert'),
            __('BEFORE YOU CHOOSE', 'wconvert'),
            __('A / CHEST WIDTH', 'wconvert'),
            __('B / BODY LENGTH', 'wconvert'),
        ],
        'headline' => __('Measure once.
Choose with confidence.', 'wconvert'),
        'body' => [
            __('Use a shirt you already like. Lay it flat without stretching the fabric.', 'wconvert'),
            __('Compare garment measurements, not body measurements. Check the product’s own size chart.', 'wconvert'),
            __('Measure straight across, just below the sleeves.', 'wconvert'),
            __('Measure from the shoulder beside the collar to the hem.', 'wconvert'),
        ],
        'cta_label' => __('Open the size and fit guide', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
