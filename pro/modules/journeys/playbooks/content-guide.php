<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'content-guide',
    'name' => __('Recommend a guide before asking for email', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'journey-content-guide',
    'notes' => __('Edit the questions, result copy and resource links. Configure the optional email destination and test the skip route. The result is available without contact details.', 'wconvert-pro'),
    'copy' => [
        'screens' => [
            'screen:interests' => [
                'headline' => __('Find a useful guide', 'wconvert-pro'),
                'body' => __('Choose what interests you. We will recommend a useful guide.', 'wconvert-pro'),
                'next_label' => __('See my guide', 'wconvert-pro'),
            ],
            'screen:guide' => [
                'next_label' => __('Optional email updates', 'wconvert-pro'),
                'back_label' => __('Back', 'wconvert-pro'),
            ],
            'submission:email' => [
                'headline' => __('Want more guides?', 'wconvert-pro'),
                'body' => __('Your result is already available. Signup is optional.', 'wconvert-pro'),
                'email_label' => __('Email address', 'wconvert-pro'),
                'email_placeholder' => __('you@example.com', 'wconvert-pro'),
                'consent_text' => [
                    'text' => /* translators: %s: a link to the site's privacy policy. */ __('Send me email guides and updates. %s', 'wconvert-pro'),
                    'link' => [
                        'label' => __('Privacy Policy', 'wconvert-pro'),
                    ],
                ],
                'cta_label' => __('Sign up', 'wconvert-pro'),
                'skip_label' => __('No thanks', 'wconvert-pro'),
                'back_label' => __('Back to guide', 'wconvert-pro'),
            ],
            'acknowledgement' => [
                'success_headline' => __('Thanks for visiting', 'wconvert-pro'),
                'success_body' => __('Your guide is ready whenever you return to it.', 'wconvert-pro'),
                'back_label' => __('Back', 'wconvert-pro'),
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
