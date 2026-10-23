<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'delivery-announcement',
    'name' => __('Explain store delivery terms', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'notes' => __('Replace the sample delivery threshold, region and shop link. The bar announces your terms; it does not calculate cart progress or apply free delivery.', 'wconvert-pro'),
    'copy' => [
        'badge' => __('Delivery', 'wconvert-pro'),
        'headline' => __('Free UK delivery over £40', 'wconvert-pro'),
        'cta_label' => __('Explore the shop', 'wconvert-pro'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];
