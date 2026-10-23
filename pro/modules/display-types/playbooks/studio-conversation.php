<?php

defined('ABSPATH') || exit;

return [
    'id' => 'studio-conversation',
    'name' => __('Start a conversation with the studio', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'conversation-note',
    'business_types' => ['services'],
    'notes' => __('Show on service information pages. Monitor captured enquiries and configure a reply process. Topic is optional; no automatic booking or live agent is implied.', 'wconvert-pro'),
    'copy' => [
        'screens' => [
            'screen:request' => [
                'eyebrow' => __('A NOTE TO THE STUDIO', 'wconvert-pro'),
                'headline' => __('What are you
working on?', 'wconvert-pro'),
                'body' => __('Choose a starting point. We will reply by email after reviewing your enquiry.', 'wconvert-pro'),
                'interest_label' => __('What would you like help with? (optional)', 'wconvert-pro'),
                'interest_placeholder' => __('Choose an option', 'wconvert-pro'),
                'interest_options' => [
                    'options' => [
                        [
                            'value' => 'repair',
                            'label' => __('Repairing something', 'wconvert-pro'),
                        ],
                        [
                            'value' => 'alteration',
                            'label' => __('Changing or adapting it', 'wconvert-pro'),
                        ],
                        [
                            'value' => 'advice',
                            'label' => __('Advice before deciding', 'wconvert-pro'),
                        ],
                    ],
                ],
                'next_label' => __('Add my reply address', 'wconvert-pro'),
                'fine_print' => __('An enquiry form, not live chat.', 'wconvert-pro'),
            ],
            'submission:email-interest' => [
                'eyebrow' => __('YOUR NOTE / REPLY DETAILS', 'wconvert-pro'),
                'headline' => __('Where can we reply?', 'wconvert-pro'),
                'body' => __('Leave your email so the team can continue the conversation.', 'wconvert-pro'),
                'email_label' => __('Email address', 'wconvert-pro'),
                'email_placeholder' => __('you@example.com', 'wconvert-pro'),
                'cta_label' => __('Send my enquiry', 'wconvert-pro'),
                'back_label' => __('Back to my topic', 'wconvert-pro'),
                'fine_print' => __('Used only to respond. Nothing is booked.', 'wconvert-pro'),
            ],
            'acknowledgement' => [
                'eyebrow' => __('NOTE RECEIVED', 'wconvert-pro'),
                'success_headline' => __('Your note is with us', 'wconvert-pro'),
                'success_body' => __('Your email and any selected topic have been recorded. The team can use them to reply; no appointment is booked.', 'wconvert-pro'),
                'close_label' => __('Close', 'wconvert-pro'),
            ],
        ],
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
