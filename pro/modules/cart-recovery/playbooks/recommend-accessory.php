<?php

defined('ABSPATH') || exit;
return [
    'id' => 'recommend-accessory',
    'name' => __('Recommend a compatible accessory', 'wconvert-pro'),
    'business_types' => ['stores'],
    'goal' => 'promote_offer',
    'template_id' => 'cart-accessories',
    'notes' => __('Choose a main product and useful extras, then verify their location on its product page. Counts product clicks.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('A useful addition', 'wconvert-pro'), 'headline' => __('Complete your setup', 'wconvert-pro'), 'body' => __('Take a closer look at these accessories.', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
