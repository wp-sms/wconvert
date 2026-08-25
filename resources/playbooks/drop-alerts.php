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
    'name' => __('Drop alerts', 'wconvert'),
    'goal' => 'grow_sms_list',
    'template_id' => 'stacked-signup',
    'notes' => __(
        'SMS is read within minutes, which is exactly why the promise has to be narrow. Say how often '
        . 'you will message and keep to it — the unsubscribe rate on a broken promise is immediate.',
        'wconvert'
    ),
    'copy' => [
        'headline' => __('Text me when it drops', 'wconvert'),
        'body' => __('One message when something new lands. Nothing else, ever.', 'wconvert'),
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'cta_label' => __('Sign me up', 'wconvert'),
        'fine_print' => [
            'text' => __('Message rates may apply, and you can stop at any time. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('You are signed up', 'wconvert'),
        'success_body' => __('Watch out for a message when the next drop lands.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'value' => 12],
    ],
    'destination_hint' => [
        'types' => ['wsms'],
        'fields' => ['phone'],
    ],
];
