<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reader-panel-interest',
    'name' => __('Collect interest in a reader panel', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['publishers'],
    'notes' => __('Use on community pages. Follow up with the purpose and time commitment. No panel place or research participation is confirmed.', 'wconvert'),
    'copy' => ['headline' => __('Help shape the next issue.', 'wconvert'), 'body' => __('Tell us how you would like to contribute to a reader discussion. We will reply about possible next steps.', 'wconvert'), 'interest_label' => __('How would you like to help? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose a topic', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Discuss article ideas', 'wconvert')], ['value' => 'option-2', 'label' => __('Review a sample issue', 'wconvert')], ['value' => 'option-3', 'label' => __('Share reading preferences', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Express interest', 'wconvert'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
