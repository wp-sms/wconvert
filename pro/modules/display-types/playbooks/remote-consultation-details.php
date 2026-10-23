<?php

defined('ABSPATH') || exit;

return [
    'id' => 'remote-consultation-details',
    'name' => __('Explain how a remote consultation works', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['services'],
    'notes' => __('Target consultation pages. Link to actual duration, fees, access requirements and next steps; clicking does not book an appointment.', 'wconvert-pro'),
    'copy' => ['badge' => __('Meet online', 'wconvert-pro'), 'headline' => __('A first conversation, from your desk.', 'wconvert-pro'), 'cta_label' => __('See how it works', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
