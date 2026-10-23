<?php

defined('ABSPATH') || exit;

return [
    'id' => 'product-demo-enquiry',
    'name' => __('Ask for a product demonstration', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['stores'],
    'notes' => __('Use on demonstration pages. Ask for the product and preferred format during follow-up. No live session is booked by this form.', 'wconvert-pro'),
    'copy' => ['headline' => __('See how it works.', 'wconvert-pro'), 'body' => __('Choose what you would like to see in a demonstration. We will reply to discuss a suitable format.', 'wconvert-pro'), 'interest_label' => __('What would help? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Setup and first use', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('Everyday features', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Care and storage', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Discuss a demonstration', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
