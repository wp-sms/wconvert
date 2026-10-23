<?php

defined('ABSPATH') || exit;

return [
    'id' => 'visiting-details',
    'name' => __('Explain service visit arrangements', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'availability-note',
    'business_types' => ['services'],
    'notes' => __('Link to accurate service areas, hours and visit arrangements. Keep the destination up to date and never imply a slot has been reserved.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('Before you enquire', 'wconvert-pro'), __('Where', 'wconvert-pro'), __('When', 'wconvert-pro')],
        'headline' => __('A visit that fits your plans.', 'wconvert-pro'),
        'body' => [__('Check the areas we serve.', 'wconvert-pro'), __('See current hours and visit arrangements.', 'wconvert-pro')],
        'cta_label' => __('Check visiting details', 'wconvert-pro'),
        'fine_print' => __('An enquiry does not reserve a visit.', 'wconvert-pro'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];
