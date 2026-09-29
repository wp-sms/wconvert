<?php

defined('ABSPATH') || exit;

return [
    'id' => 'gift-wrap-details',
    'name' => __('Explain gift wrapping before purchase', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['stores'],
    'notes' => __('Show on gift collection pages. Link to wrapping prices, eligible items and message limits; this bar does not add wrapping to an order.', 'wconvert'),
    'copy' => ['badge' => __('Gifting', 'wconvert'), 'headline' => __('A gift, ready to give.', 'wconvert'), 'cta_label' => __('See wrapping options', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
