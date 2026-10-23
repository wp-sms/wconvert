<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'sale-deadline',
    'name' => __('Show a real sale deadline', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-countdown',
    'notes' => __('Set the genuine sale end date and time zone in Schedule, add the sale URL and confirm that the offer ends at that time. The countdown stays unconfigured until a deadline is set. Exclude checkout.', 'wconvert-pro'),
    'copy' => [
        'headline' => __('Time left to shop the sale', 'wconvert-pro'),
        'cta_label' => __('See sale details', 'wconvert-pro'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
];
