<?php

defined('ABSPATH') || exit;

return [
    'id' => 'sale-deadline',
    'name' => __('Show a real sale deadline', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-countdown',
    'notes' => __('Set the genuine sale end date and time zone in Schedule, add the sale URL and confirm that the offer ends at that time. The countdown stays unconfigured until a deadline is set. Exclude checkout.', 'wconvert'),
    'copy' => [
        'headline' => __('Time left to shop the sale', 'wconvert'),
        'cta_label' => __('See sale details', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
];
