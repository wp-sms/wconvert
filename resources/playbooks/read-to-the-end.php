<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'read-to-the-end',
    'name' => __('Newsletter signup while reading', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'sunday-marginalia',
    'notes' => __('Offer a weekly editorial letter after a reader reaches 90% of a page. Add your publication name, replace the sample excerpt with your own writing and set a cadence you can keep in every line. Connect your email service, then choose which articles should show the invitation.', 'wconvert'),
    'copy' => [
        'body' => [
            __('An essay to keep', 'wconvert'),
            __('Every Sunday', 'wconvert'),
            __('One essay on books, places and the things we nearly miss, every Sunday.', 'wconvert'),
            [
                /* translators: %i: the italic excerpt from the newsletter. */
                'text' => __('%i', 'wconvert'),
                'italic' => __('The best bookshops leave a little room for getting lost.', 'wconvert'),
            ],
        ],
        'headline' => __('One good essay.
A slower Sunday.', 'wconvert'),
        'eyebrow' => [
            __('A taste of the letter', 'wconvert'),
            __('Made for reading', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Send me the Sunday letter. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Send me the Sunday letter', 'wconvert'),
        'fine_print' => [
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('Sunday emails. Unsubscribe anytime. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('Sunday emails. Unsubscribe anytime. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
        ],
        'success_headline' => __('Your request
is in.', 'wconvert'),
        'success_body' => [
            __('We have received your request for the Sunday letter.', 'wconvert'),
            __('Thank you for making a little room for reading.', 'wconvert'),
        ],
    ],
    'rules' => [
        [
            'type' => 'scroll_depth',
            'percent' => 90,
        ],
    ],
    'destination_hint' => [
        'types' => [
            'wsms',
            'email_service_provider',
        ],
        'fields' => [
            'email',
        ],
    ],
];
