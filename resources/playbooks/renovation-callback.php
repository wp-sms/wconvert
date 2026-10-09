<?php

defined('ABSPATH') || exit;

return [
    'id' => 'renovation-callback',
    'name' => __('Request a renovation planning call', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'callback-notes',
    'business_types' => ['services'],
    'notes' => __('Place below renovation services. Use the phone library and confirm country selection. Agree timing separately; this does not book a call.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('A project starts with a conversation', 'wconvert'),
            __('Your next step', 'wconvert')
        ],
        'headline' => __('Talk through your renovation.', 'wconvert'),
        'body' => __('Leave your number to discuss the scope and next steps for your project.', 'wconvert'),
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Alex Morgan', 'wconvert'),
        'phone_label' => __('Phone number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900123', 'wconvert'),
        'interest_label' => __('What can we help with? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a topic', 'wconvert'),
        'interest_options' => [
            'options' => [
                [
                    'value' => 'new_project',
                    'label' => __('A new project', 'wconvert')
                ],
                [
                    'value' => 'improvement',
                    'label' => __('Improving something existing', 'wconvert')
                ],
                [
                    'value' => 'advice',
                    'label' => __('Help choosing the next step', 'wconvert')
                ]
            ]
        ],
        'consent_text' => __('Call me about my renovation enquiry.', 'wconvert'),
        'fine_print' => [
            __('No appointment is booked here.', 'wconvert'),
            __('Your number is for responding to this enquiry.', 'wconvert')
        ],
        'cta_label' => __('Request a planning call', 'wconvert'),
        'success_headline' => [
            __('Thank you for getting in touch.', 'wconvert'),
            __('Planning call requested', 'wconvert')
        ],
        'success_body' => [
            __('We have received your renovation enquiry.', 'wconvert'),
            __('Your request is saved. The team can contact you to agree a time.', 'wconvert')
        ]
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['phone']],
];
