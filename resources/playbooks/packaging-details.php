<?php

defined('ABSPATH') || exit;

return [
    'id' => 'packaging-details',
    'name' => __('Explain packaging before checkout', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'reading-slip',
    'business_types' => ['stores'],
    'notes' => __('Embed near delivery information. Link to your actual packaging policy and substantiate environmental claims.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Before it reaches you', 'wconvert'),
        'headline' => __('What arrives with your order.', 'wconvert'),
        'body' => __('See how each item is packed, which materials we use and how to reuse or recycle them.', 'wconvert'),
        'fine_print' => __('Materials and disposal options vary by product and location.', 'wconvert'),
        'cta_label' => __('Read about packaging', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
