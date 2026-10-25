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
                'headline' => __('A weekly briefing on the headlines', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'email_placeholder' => __('you@example.com', 'wconvert'),
                'consent_text' => __('Email me the weekly headline briefing. I can unsubscribe anytime.', 'wconvert'),
                'cta_label' => __('Request the weekly briefing', 'wconvert')
            ],
            'submission:phone' => [
                'headline' => __('Want occasional headline texts too?', 'wconvert'),
                'body' => __('Your email request is received. You can finish now or also request occasional editorial texts.', 'wconvert'),
                'phone_label' => __('Mobile number', 'wconvert'),
                'consent_text' => __('Text me occasional editorial headlines. I can opt out.', 'wconvert'),
                'back_label' => __('Change email', 'wconvert'),
                'cta_label' => __('Request headline texts', 'wconvert'),
                'skip_label' => __('Finish without texts', 'wconvert')
            ],
            'acknowledgement' => [
                'success_headline' => __('Briefing request received', 'wconvert'),
                'success_body' => __('Thank you. Your briefing request is received, and your text request too if you added a number.', 'wconvert')
            ]
        ]
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
