<?php

defined('ABSPATH') || exit;

return [
    'id' => 'earlier-appointment-enquiry',
    'name' => __('Ask about an earlier appointment', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'availability-desk',
    'business_types' => ['services'],
    'notes' => __('Embed on your appointment information page. Monitor requests and contact visitors manually when a suitable time opens. This records a preference, not a queue position, reservation or booking change. Set expectations for how long you keep requests.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Flexible on timing?', 'wconvert'), __('Your enquiry', 'wconvert')],
        'headline' => __('Could an earlier time work for you?', 'wconvert'),
        'body' => __('Tell us when you are usually available. We can contact you if a suitable appointment opens up.', 'wconvert'),
        'interest_label' => __('When could you come? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a preference', 'wconvert'),
        'interest_options' => ['options' => [
            ['value' => 'weekday', 'label' => __('Weekdays', 'wconvert')],
            ['value' => 'weekend', 'label' => __('Weekends', 'wconvert')],
            ['value' => 'flexible', 'label' => __('Either works', 'wconvert')],
        ]],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('You may contact me about a suitable appointment.', 'wconvert'),
        'cta_label' => __('Ask about an earlier time', 'wconvert'),
        'fine_print' => __('We use your details to respond. No place is reserved and any existing booking stays the same.', 'wconvert'),
        'success_headline' => __('Enquiry received', 'wconvert'),
        'success_body' => __('Thank you. We have received your details and any availability preference you selected. Your existing booking has not changed.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
