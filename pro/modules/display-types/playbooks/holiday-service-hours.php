<?php

defined('ABSPATH') || exit;

return [
    'id' => 'holiday-service-hours',
    'name' => __('Explain holiday service hours', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['services'],
    'notes' => __('Publish only around a real closure and remove it afterwards. Link to dated opening hours and explain whether support is monitored.', 'wconvert-pro'),
    'copy' => ['badge' => __('Opening hours', 'wconvert-pro'), 'headline' => __('Planning around the holiday?', 'wconvert-pro'), 'cta_label' => __('Check service hours', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
