<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-shop-is-sleeping',
    'name' => __('The shop is sleeping', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-shop-is-sleeping',
    'notes' => __('Link to your seasonal gift edit or information page. Replace all example opening dates and hours before publishing.', 'wconvert'),
    'copy' => ['eyebrow' => __('A NOTE FROM OUR LITTLE SHOP', 'wconvert'), 'headline' => __('Closed 25–26 December.', 'wconvert'), 'body' => __('Dispatch resumes on 27 December.', 'wconvert'), 'cta_label' => __('See holiday hours', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
