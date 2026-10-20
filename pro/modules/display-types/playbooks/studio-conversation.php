<?php

defined('ABSPATH') || exit;

return [
    'id' => 'studio-conversation',
    'name' => __('Start a conversation with the studio', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'conversation-note',
    'business_types' => ['services'],
    'notes' => __('Show on service information pages. Monitor captured enquiries and configure a reply process. Topic is optional; no automatic booking or live agent is implied.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:request' => [
                'eyebrow' => __('A NOTE TO THE STUDIO', 'wconvert'),
                'headline' => __('What are you
working on?', 'wconvert'),
                'body' => __('Choose a starting point. We will reply by email after reviewing your enquiry.', 'wconvert'),
                'interest_label' => __('What would you like help with? (optional)', 'wconvert'),
                'interest_placeholder' => __('Choose an option', 'wconvert'),
                'interest_options' => [
                    'options' => [
                        [
                            'value' => 'repair',
                            'label' => __('Repairing something', 'wconvert'),
                        ],
                        [
                            'value' => 'alteration',
                            'label' => __('Changing or adapting it', 'wconvert'),
                        ],
                        [
                            'value' => 'advice',
                            'label' => __('Advice before deciding', 'wconvert'),
                        ],
                    ],
                ],
                'next_label' => __('Add my reply address', 'wconvert'),
                'fine_print' => __('An enquiry form, not live chat.', 'wconvert'),
            ],
            'submission:email-interest' => [
                'eyebrow' => __('YOUR NOTE / REPLY DETAILS', 'wconvert'),
                'headline' => __('Where can we reply?', 'wconvert'),
                'body' => __('Leave your email so the team can continue the conversation.', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'email_placeholder' => __('you@example.com', 'wconvert'),
                'cta_label' => __('Send my enquiry', 'wconvert'),
                'back_label' => __('Back to my topic', 'wconvert'),
                'fine_print' => __('Used only to respond. Nothing is booked.', 'wconvert'),
            ],
            'acknowledgement' => [
                'eyebrow' => __('NOTE RECEIVED', 'wconvert'),
                'success_headline' => __('Your note is with us', 'wconvert'),
                'success_body' => __('Your email and any selected topic have been recorded. The team can use them to reply; no appointment is booked.', 'wconvert'),
                'close_label' => __('Close', 'wconvert'),
            ],
        ],
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
