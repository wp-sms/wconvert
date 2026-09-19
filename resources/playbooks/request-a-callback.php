<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'request-a-callback',
    'name' => __('Request a callback', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'callback-notes',
    'notes' => __('Place the WConvert block or shortcode on your service page. Only a phone number is required; edit the optional topics to match your business. Requests are kept in Leads. Arrange a process to review them and return calls, and connect a destination if your workflow needs one. This records a request, not a booked appointment.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('A conversation, to begin', 'wconvert'),
            __('A conversation, to begin', 'wconvert'),
        ],
        'headline' => __('Request a callback
about your project.', 'wconvert'),
        'body' => __('Leave your number to discuss your project and how we can help.', 'wconvert'),
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
                    'label' => __('A new project', 'wconvert'),
                ],
                [
                    'value' => 'improvement',
                    'label' => __('Improving something existing', 'wconvert'),
                ],
                [
                    'value' => 'advice',
                    'label' => __('Help choosing the next step', 'wconvert'),
                ],
            ],
        ],
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Call me about this request. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'fine_print' => [
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('We’ll use your number to reply. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
            __('Your number is only for this reply.', 'wconvert'),
        ],
        'cta_label' => __('Request my callback', 'wconvert'),
        'success_headline' => [
            __('Your request
has a place here.', 'wconvert'),
            __('Callback request received', 'wconvert'),
        ],
        'success_body' => [
            __('Thank you for getting in touch about your project.', 'wconvert'),
            __('We have received your details and your request for a call. This is not an appointment confirmation.', 'wconvert'),
        ],
    ],
    'rules' => [
        [
            'type' => 'page_load',
        ],
    ],
];
