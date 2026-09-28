<?php

defined('ABSPATH') || exit;

return [
    'id' => 'content-guide',
    'name' => __('Recommend a guide before asking for email', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'journey-content-guide',
    'notes' => __('Edit the questions, result copy and resource links. Configure the optional email destination and test the skip route. The result is available without contact details.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:interests' => [
                'headline' => __('Find a useful guide', 'wconvert'),
                'body' => __('Choose what interests you. We will recommend a useful guide.', 'wconvert'),
                'next_label' => __('See my guide', 'wconvert'),
            ],
            'screen:guide' => [
                'next_label' => __('Optional email updates', 'wconvert'),
                'back_label' => __('Back', 'wconvert'),
            ],
            'submission:email' => [
                'headline' => __('Want more guides?', 'wconvert'),
                'body' => __('Your result is already available. Signup is optional.', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'consent_text' => [
                    'text' => __('Send me email guides and updates. %s', 'wconvert'),
                    'link' => [
                        'label' => __('Privacy Policy', 'wconvert'),
                    ],
                ],
                'cta_label' => __('Sign up', 'wconvert'),
                'skip_label' => __('No thanks', 'wconvert'),
                'back_label' => __('Back to guide', 'wconvert'),
            ],
            'acknowledgement' => [
                'success_headline' => __('Thanks for visiting', 'wconvert'),
                'success_body' => __('Your guide is ready whenever you return to it.', 'wconvert'),
                'back_label' => __('Back', 'wconvert'),
            ],
        ],
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];
