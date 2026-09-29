<?php

defined('ABSPATH') || exit;

return [
    'id' => 'dispatch-schedule',
    'name' => __('Explain dispatch days before ordering', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['stores'],
    'notes' => __('Target product browsing before purchase. Link to current dispatch days, cutoff and exceptions. Do not imply that dispatch means delivery.', 'wconvert'),
    'copy' => ['badge' => __('Dispatch', 'wconvert'), 'headline' => __('Know when your order can leave.', 'wconvert'), 'cta_label' => __('Check dispatch days', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
