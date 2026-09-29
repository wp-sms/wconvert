<?php

defined('ABSPATH') || exit;

return [
    'id' => 'headlines-optional-sms',
    'name' => __('Offer headlines by email with optional texts', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-email-then-sms',
    'business_types' => ['publishers'],
    'notes' => __('Save the email request first. SMS is optional and needs its own consent and service. Publish only with a defined editorial schedule for both channels.', 'wconvert'),
    'copy' => [
        'screens' => [
            'submission:email' => [
                'headline' => __('Make sense of the week', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'consent_text' => __('Email me the weekly headline briefing. I can unsubscribe anytime.', 'wconvert'),
                'cta_label' => __('Request the weekly briefing', 'wconvert')
            ],
            'submission:phone' => [
                'headline' => __('Want occasional headline texts too?', 'wconvert'),
                'body' => __('Your email request is received. You can finish now or also request occasional editorial texts.', 'wconvert'),
                'phone_label' => __('Mobile number', 'wconvert'),
                'consent_text' => __('Text me occasional editorial headlines. I can opt out.', 'wconvert'),
                'back_label' => __('Review email', 'wconvert'),
                'cta_label' => __('Request headline texts', 'wconvert'),
                'skip_label' => __('Finish without texts', 'wconvert')
            ],
            'acknowledgement' => [
                'success_headline' => __('Your requests are received', 'wconvert'),
                'success_body' => __('Thank you. We have received the details and choices you submitted.', 'wconvert')
            ]
        ]
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
