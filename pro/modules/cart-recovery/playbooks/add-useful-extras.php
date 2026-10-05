<?php

defined('ABSPATH') || exit;
return [
    'id' => 'add-useful-extras',
    'name' => __('Add useful extras', 'wconvert'),
    'business_types' => ['stores'],
    'goal' => 'increase_basket_value',
    'template_id' => 'cart-additions',
    'notes' => __('Choose a main product and useful extras. Shoppers can add simple products without leaving the page. Counts confirmed additions.', 'wconvert'),
    'copy' => ['eyebrow' => __('A useful addition', 'wconvert'), 'headline' => __('Complete your setup', 'wconvert'), 'body' => __('Add an extra to complete your setup.', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
