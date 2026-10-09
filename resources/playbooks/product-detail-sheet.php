<?php

defined('ABSPATH') || exit;

return [
    'id' => 'product-detail-sheet',
    'name' => __('Show a desk lamp in detail', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'product-detail-sheet',
    'business_types' => ['stores'],
    'notes' => __('The lamp and dimensions are illustrative. Replace them with verified product facts and a relevant product photo or illustration, or hide the picture. Set the product URL; price and availability belong on that page.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A closer look', 'wconvert'), __('Footprint', 'wconvert'), __('Materials', 'wconvert'), __('Made for', 'wconvert')],
        'headline' => __('A little light for your desk.', 'wconvert'),
        'body' => [__('18 × 18 cm base', 'wconvert'), __('Powder-coated steel', 'wconvert'), __('Reading corners and small desks', 'wconvert'), __('The Task lamp, for everyday reading.', 'wconvert')],
        'cta_label' => __('View lamp details', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
