<?php

defined('ABSPATH') || exit;
return [
    'id' => 'recommend-accessory',
    'name' => __('Recommend a compatible accessory', 'wconvert'),
    'business_types' => ['stores'],
    'goal' => 'promote_offer',
    'template_id' => 'cart-accessories',
    'notes' => __('Choose a main product and useful extras, then verify their location on its product page. Counts product clicks.', 'wconvert'),
    'copy' => ['eyebrow' => __('A useful addition', 'wconvert'), 'headline' => __('Complete your setup', 'wconvert'), 'body' => __('Take a closer look at these accessories.', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
