<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-winter-hours',
    'name' => __('Winter hours', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-winter-hours',
    'notes' => __('Link to your seasonal gift edit or information page. Replace all example opening dates and hours before publishing.', 'wconvert'),
    'copy' => ['eyebrow' => __('OUR WINTER HOURS', 'wconvert'), 'headline' => __('Your holiday
opening hours.', 'wconvert'), 'body' => [__('24 December', 'wconvert'), __('10 am – 2 pm', 'wconvert'), __('25–26 December', 'wconvert'), __('Closed', 'wconvert'), __('27 December', 'wconvert'), __('10 am – 6 pm', 'wconvert'), __('A little change to our opening hours. Find your best time to visit.', 'wconvert')], 'cta_label' => __('See full opening hours', 'wconvert'), 'fine_print' => __('Check the full timetable before you visit or order.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
