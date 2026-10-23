<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-holiday-post',
    'name' => __('Holiday post', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-holiday-post',
    'notes' => __('Link to your seasonal gift edit or information page. Place the block or shortcode where this belongs. Replace all example opening dates and hours before publishing.', 'wconvert'),
    'copy' => ['eyebrow' => __('HOLIDAY POST', 'wconvert'), 'headline' => __('Check your
Christmas delivery.', 'wconvert'), 'body' => __('Christmas delivery has its own timetable. Check dates and delivery areas before ordering.', 'wconvert'), 'cta_label' => __('Read delivery information', 'wconvert'), 'fine_print' => __('Check the full timetable before you visit or order.', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
