<?php

defined('ABSPATH') || exit;

return [
    'id' => 'sms-message-preview',
    'name' => __('See a sample before choosing texts', 'wconvert'),
    'goal' => 'grow_sms_list',
    'template_id' => 'message-sample',
    'business_types' => ['stores'],
    'notes' => __('Replace the illustrative message and frequency with your actual collection-text programme. Configure an SMS destination and its opt-out process, or use Collect only. Show on relevant collection pages after 20 seconds, exclude checkout and respect dismissal. A saved request does not establish provider subscription or message delivery.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A preview, before you decide', 'wconvert'), __('Example message', 'wconvert'), __('Request received', 'wconvert')],
        'headline' => [__('A little news.
By text.', 'wconvert'), __('Choose your updates.', 'wconvert')],
        'body' => [__('Collection news, up to twice a month.', 'wconvert'), __('The new ceramic collection is here. Take a look when you have a moment.', 'wconvert')],
        'fine_print' => [__('An illustrative message, not a text we have sent.', 'wconvert'), __('Message rates may apply. You can opt out of future texts.', 'wconvert')],
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'consent_text' => __('Send me collection news by text, up to twice a month. I can opt out.', 'wconvert'),
        'cta_label' => __('Request collection texts', 'wconvert'),
        'success_headline' => __('Your text request is received.', 'wconvert'),
        'success_body' => __('Thank you. We have received your request for collection texts.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['phone']],
];
