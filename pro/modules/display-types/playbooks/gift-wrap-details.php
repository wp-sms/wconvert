<?php

defined('ABSPATH') || exit;

return [
    'id' => 'gift-wrap-details',
    'name' => __('Explain gift wrapping before purchase', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['stores'],
    'notes' => __('Show on gift collection pages. Link to wrapping prices, eligible items and message limits; this bar does not add wrapping to an order.', 'wconvert-pro'),
    'copy' => ['badge' => __('Gifting', 'wconvert-pro'), 'headline' => __('A gift, ready to give.', 'wconvert-pro'), 'cta_label' => __('See wrapping options', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
