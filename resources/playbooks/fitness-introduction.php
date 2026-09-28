<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fitness-introduction',
    'name' => __('Request a fitness studio introduction', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-phone',
    'business_types' => ['services'],
    'notes' => __('Embed below introductory class information. Keep health history out of this form and discuss requirements through the studio’s appropriate intake process. A trial is not booked.', 'wconvert'),
    'copy' => [
        'headline' => __('Find a comfortable place to start.', 'wconvert'),
        'body' => __('Request a call about the studio, class formats and how a first visit works.', 'wconvert'),
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'cta_label' => __('Request an introductory call', 'wconvert'),
        'consent_text' => __('Call me about visiting the fitness studio.', 'wconvert'),
        'fine_print' => __('We use your details to respond to this request. No appointment is confirmed.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['phone']],
];
