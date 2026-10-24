<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-another-good-round',
    'name' => __('Another good round', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-another-good-round',
    'notes' => __('Choose where requests are collected and how your team will reply.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Again / repair & reuse', 'wconvert-pro'), __('Again / repair & reuse', 'wconvert-pro')], 'headline' => __('Good things
deserve
another round.', 'wconvert-pro'), 'body' => ['text' => __('Ask us about restoring your favourite bag. A small repair can make a familiar piece feel ready again.', 'wconvert-pro')], 'interest_label' => __('What needs attention?', 'wconvert-pro'), 'interest_placeholder' => __('Choose an option', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'strap', 'label' => __('Strap or handle', 'wconvert-pro')], ['value' => 'zip', 'label' => __('Zip or fastening', 'wconvert-pro')], ['value' => 'other', 'label' => __('Something else', 'wconvert-pro')]]], 'name_label' => __('Your name', 'wconvert-pro'), 'name_placeholder' => __('Your name', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Ask about restoration', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => ['text' => __('We use these details to respond to your request.', 'wconvert-pro')], 'success_headline' => __('Your restoration enquiry is received.', 'wconvert-pro'), 'success_body' => ['text' => __('Thank you for giving a familiar piece another chance. Assessment is arranged separately.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
