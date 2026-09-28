<?php

defined('ABSPATH') || exit;

return [
    'id' => 'journey-offer-first',
    'name' => __('Introduce the signup first', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-offer-first',
    'business_types' => [
        'stores',
    ],
    'notes' => __('Use on maker-story pages after meaningful reading. Continue only reveals the form; it saves nothing. Announcements do not reserve a place.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:offer' => [
                'eyebrow' => __('Behind the making', 'wconvert'),
                'headline' => __('A closer look at how it is made.', 'wconvert'),
                'body' => __('Occasional email invitations to maker demonstrations, with details when announced.', 'wconvert'),
                'next_label' => __('Tell me more', 'wconvert'),
                'close_label' => __('Maybe later', 'wconvert'),
            ],
            'submission:email' => [
                'eyebrow' => __('A little closer to the craft', 'wconvert'),
                'headline' => __('Get maker-session news.', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'email_placeholder' => __('you@example.com', 'wconvert'),
                'consent_text' => __('Email me maker-session announcements. I can unsubscribe anytime.', 'wconvert'),
                'cta_label' => __('Request session news', 'wconvert'),
            ],
            'acknowledgement' => [
                'success_headline' => __('Request received', 'wconvert'),
                'success_body' => __('Thank you. We have received your request for maker-session announcements.', 'wconvert'),
            ],
        ],
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 20,
        ],
    ],
    'destination_hint' => [
        'types' => [],
        'fields' => [
            'email',
        ],
    ],
];
