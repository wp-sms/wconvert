<?php

defined('ABSPATH') || exit;

return [
    'id' => 'delivery-announcement',
    'name' => __('Explain store delivery terms', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'notes' => __('Replace the sample delivery threshold, region and shop link. The bar announces your terms; it does not calculate cart progress or apply free delivery.', 'wconvert'),
    'copy' => [
        'badge' => __('Delivery', 'wconvert'),
        'headline' => __('Free UK delivery over £40', 'wconvert'),
        'cta_label' => __('Explore the shop', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];
