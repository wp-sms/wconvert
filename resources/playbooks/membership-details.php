<?php

defined('ABSPATH') || exit;

return [
    'id' => 'membership-details',
    'name' => __('Explain a publication’s membership', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'inline-benefits',
    'business_types' => ['publishers'],
    'notes' => __('List only real member benefits. Link to a page explaining pricing, renewal and cancellation before visitors decide.', 'wconvert'),
    'copy' => [
        'headline' => __('More time with the ideas you value.', 'wconvert'),
        'body' => [
            __('The full essay archive', 'wconvert'),
            __('Member discussion sessions', 'wconvert'),
            __('A way to support independent work', 'wconvert')
        ],
        'cta_label' => __('Explore membership', 'wconvert'),
        'fine_print' => __('See current benefits, pricing and terms on the membership page.', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
