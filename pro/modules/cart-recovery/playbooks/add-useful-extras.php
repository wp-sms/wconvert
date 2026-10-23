<?php

defined('ABSPATH') || exit;
return [
    'id' => 'add-useful-extras',
    'name' => __('Add useful extras', 'wconvert-pro'),
    'business_types' => ['stores'],
    'goal' => 'increase_basket_value',
    'template_id' => 'cart-additions',
    'notes' => __('Choose a main product and useful extras. Shoppers can add simple products without leaving the page. Counts confirmed additions.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('A useful addition', 'wconvert-pro'), 'headline' => __('Complete your setup', 'wconvert-pro'), 'body' => __('Add an extra to complete your setup.', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
