<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-by-the-fire',
    'name' => __('See you by the fire', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-by-the-fire',
    'notes' => __('Link to your seasonal gift edit or information page. Replace all example opening dates and hours before publishing.', 'wconvert'),
    'copy' => ['eyebrow' => __('COME IN FROM THE COLD', 'wconvert'), 'headline' => __('Visit us this
holiday season.', 'wconvert'), 'body' => __('Planning a visit? Check our opening hours before you make the trip.', 'wconvert'), 'cta_label' => __('See opening hours', 'wconvert'), 'fine_print' => __('Check the full timetable before you visit or order.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
