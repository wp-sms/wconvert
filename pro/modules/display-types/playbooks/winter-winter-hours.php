<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-winter-hours',
    'name' => __('Winter hours', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-winter-hours',
    'notes' => __('Link to your seasonal gift edit or information page. Replace all example opening dates and hours before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('OUR WINTER HOURS', 'wconvert-pro'), 'headline' => __('Your holiday
opening hours.', 'wconvert-pro'), 'body' => [__('24 December', 'wconvert-pro'), __('10 am – 2 pm', 'wconvert-pro'), __('25–26 December', 'wconvert-pro'), __('Closed', 'wconvert-pro'), __('27 December', 'wconvert-pro'), __('10 am – 6 pm', 'wconvert-pro'), __('A little change to our opening hours. Find your best time to visit.', 'wconvert-pro')], 'cta_label' => __('See full opening hours', 'wconvert-pro'), 'fine_print' => __('Check the full timetable before you visit or order.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
