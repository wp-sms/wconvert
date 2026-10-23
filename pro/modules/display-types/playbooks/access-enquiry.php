<?php

defined('ABSPATH') || exit;

return [
    'id' => 'access-enquiry',
    'name' => __('Ask about access before visiting', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['services'],
    'notes' => __('Use on visit pages. Reply with verified physical access information. Collect no health information; confirm any arrangement directly.', 'wconvert-pro'),
    'copy' => ['headline' => __('Plan a comfortable visit.', 'wconvert-pro'), 'body' => __('Choose an area you would like to discuss. Please keep personal or medical details out of this form.', 'wconvert-pro'), 'interest_label' => __('What would you like to check? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Entrance and parking', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('Facilities and seating', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Another access question', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Request access information', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
