<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-text-updates',
    'name' => __('Offer occasional service announcements', 'wconvert'),
    'goal' => 'grow_sms_list',
    'template_id' => 'stacked-signup',
    'business_types' => ['services'],
    'notes' => __('Connect a supported SMS service or choose Keep in WConvert only with a defined follow-up process. These are marketing announcements, not appointment reminders.', 'wconvert'),
    'copy' => [
        'headline' => __('Useful service news. By text.', 'wconvert'),
        'body' => __('Request occasional announcements about new services and seasonal availability.', 'wconvert'),
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'cta_label' => __('Request service texts', 'wconvert'),
        'consent_text' => __('Text me occasional service announcements. I can opt out.', 'wconvert'),
        'fine_print' => __('Occasional marketing texts. Message rates may apply. You can opt out.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['phone']],
];
