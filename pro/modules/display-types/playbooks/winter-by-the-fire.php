<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-by-the-fire',
    'name' => __('See you by the fire', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-by-the-fire',
    'notes' => __('Link to your seasonal gift edit or information page. Replace all example opening dates and hours before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('COME IN FROM THE COLD', 'wconvert-pro'), 'headline' => __('Visit us this
holiday season.', 'wconvert-pro'), 'body' => __('Planning a visit? Check our opening hours before you make the trip.', 'wconvert-pro'), 'cta_label' => __('See opening hours', 'wconvert-pro'), 'fine_print' => __('Check the full timetable before you visit or order.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
