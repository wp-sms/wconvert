<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-fix-it-friday',
    'name' => __('Fix-it Friday', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-fix-it-friday',
    'notes' => __('Choose where requests are collected and how your team will reply.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Fix-it Friday / local repair studio', 'wconvert-pro'), __('Fix-it Friday / local repair studio', 'wconvert-pro')], 'headline' => __('Still plenty
of life in it.', 'wconvert-pro'), 'body' => ['text' => __('Ask about repairing your favourite piece. Leave your details and we’ll discuss what might be possible.', 'wconvert-pro')], 'name_label' => __('Your name', 'wconvert-pro'), 'name_placeholder' => __('Your name', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Ask about a repair', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('We use these details to respond to your request.', 'wconvert-pro')], ['text' => __('Assessment and pricing are arranged separately.', 'wconvert-pro')], ['text' => __('Assessment and pricing are arranged separately.', 'wconvert-pro')]], 'success_headline' => __('Your repair enquiry is received.', 'wconvert-pro'), 'success_body' => ['text' => __('The studio has your request. An assessment and price are still to be arranged.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
