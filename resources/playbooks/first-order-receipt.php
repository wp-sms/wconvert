<?php

defined('ABSPATH') || exit;

return [
    'id' => 'first-order-receipt',
    'name' => __('Show a first-order offer code', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'offer-receipt',
    'business_types' => ['stores'],
    'notes' => __('Create a valid first-order coupon, match the terms to its restrictions and set the shop link. No email is collected.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('For your first order', 'wconvert'),
        'headline' => __('10% off', 'wconvert'),
        'body' => __('A little towards something you will keep.', 'wconvert'),
        'fine_print' => [__('Your checkout code', 'wconvert'), __('First order only. One use per customer. Cannot be combined with other offers.', 'wconvert')],
        'cta_label' => __('Find your first piece', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];
