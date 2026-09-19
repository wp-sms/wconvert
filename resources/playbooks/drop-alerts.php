<?php

/**
 * "Grow my SMS list" — a phone number for one message at a time.
 *
 * On the phone-capturing design rather than the email one: a field's kind is
 * part of the DESIGN, so a Template capturing an email cannot serve this Goal
 * however its words read. That is what the registration-time Slot Role check
 * catches — `phone_label` is not a Role `centred-card` declares.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'drop-alerts',
    'name' => __('New-release SMS alerts', 'wconvert'),
    'goal' => 'grow_sms_list',
    'template_id' => 'stacked-signup',
    'notes' => __('Use text updates for time-sensitive news. Say how often you will message, configure the connected service and keep the promise narrow.', 'wconvert'),
    'copy' => [
        'headline' => __('Text me when it drops', 'wconvert'),
        'body' => __('One message when something new lands. Nothing else, ever.', 'wconvert'),
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'cta_label' => __('Sign me up', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Send me new-release text alerts. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Text alerts. Message rates may apply. Stop anytime. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you for asking to hear about the next drop.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 12],
    ],
    'destination_hint' => [
        'types' => ['wsms'],
        'fields' => ['phone'],
    ],
];
