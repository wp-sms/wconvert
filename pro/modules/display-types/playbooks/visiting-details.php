<?php

defined('ABSPATH') || exit;

return [
    'id' => 'visiting-details',
    'name' => __('Explain service visit arrangements', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'availability-note',
    'business_types' => ['services'],
    'notes' => __('Link to accurate service areas, hours and visit arrangements. Keep the destination up to date and never imply a slot has been reserved.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Before you enquire', 'wconvert'), __('Where', 'wconvert'), __('When', 'wconvert')],
        'headline' => __('A visit that fits your plans.', 'wconvert'),
        'body' => [__('Check the areas we serve.', 'wconvert'), __('See current hours and visit arrangements.', 'wconvert')],
        'cta_label' => __('Check visiting details', 'wconvert'),
        'fine_print' => __('An enquiry does not reserve a visit.', 'wconvert'),
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
