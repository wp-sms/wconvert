<?php

defined('ABSPATH') || exit;

return [
    'id' => 'remote-consultation-details',
    'name' => __('Explain how a remote consultation works', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['services'],
    'notes' => __('Target consultation pages. Link to actual duration, fees, access requirements and next steps; clicking does not book an appointment.', 'wconvert'),
    'copy' => ['badge' => __('Meet online', 'wconvert'), 'headline' => __('A first conversation, from your desk.', 'wconvert'), 'cta_label' => __('See how it works', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
