<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reader-panel-interest',
    'name' => __('Collect interest in a reader panel', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['publishers'],
    'notes' => __('Use on community pages. Follow up with the purpose and time commitment. No panel place or research participation is confirmed.', 'wconvert-pro'),
    'copy' => ['headline' => __('Help shape the next issue.', 'wconvert-pro'), 'body' => __('Tell us how you would like to contribute to a reader discussion. We will reply about possible next steps.', 'wconvert-pro'), 'interest_label' => __('How would you like to help? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Discuss article ideas', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('Review a sample issue', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Share reading preferences', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Express interest', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
