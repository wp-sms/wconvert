<?php

defined('ABSPATH') || exit;

return [
    'id' => 'care-clinic-request',
    'name' => __('Ask about a product care clinic', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['stores'],
    'notes' => __('Use on care-session pages. Follow up for the item and materials. The request does not diagnose damage or book a clinic place.', 'wconvert'),
    'copy' => ['eyebrow' => __('Start with a conversation', 'wconvert'), 'headline' => __('Give it a little attention.', 'wconvert'), 'body' => __('Ask which care session could help with your item. We will reply to discuss suitability.', 'wconvert'), 'interest_label' => __('Which kind of care? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose an option', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Cleaning and storage', 'wconvert')], ['value' => 'option-2', 'label' => __('Basic maintenance', 'wconvert')], ['value' => 'option-3', 'label' => __('Help choosing a session', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Ask about a care clinic', 'wconvert'), 'fine_print' => __('A request to discuss the next step. No booking or purchase.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request and the topic you selected.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
