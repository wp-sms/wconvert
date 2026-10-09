<?php

defined('ABSPATH') || exit;

return [
    'id' => 'holiday-service-hours',
    'name' => __('Explain holiday service hours', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['services'],
    'notes' => __('Publish only around a real closure and remove it afterwards. Link to dated opening hours and explain whether support is monitored.', 'wconvert'),
    'copy' => ['badge' => __('Opening hours', 'wconvert'), 'headline' => __('Planning around the holiday?', 'wconvert'), 'cta_label' => __('Check service hours', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
