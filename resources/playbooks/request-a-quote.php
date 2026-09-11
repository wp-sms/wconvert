<?php

/**
 * An enquiry belongs on the page where the visitor asks for help.
 *
 * Placement supplies the context: an inline block on the quote page needs no
 * delayed or scroll trigger. Only the reply address is required. The service
 * answer is an optional stable value, with translated labels that can change
 * without changing the answer a receiving service stores.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'request-a-quote',
    'name' => __('Request a quote', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'notes' => __('Place the WConvert block or shortcode on your quote page and edit the service choices to match your business. To send the service answer to MailPoet, select a custom text field under Save interest in MailPoet in the destination settings. This applies to new subscribers only; existing subscriber fields stay unchanged. Follow up in your connected service.', 'wconvert'),
    'copy' => [
        'headline' => __('Let us help with your next project', 'wconvert'),
        'body' => __('Leave your email so we can discuss what you need and prepare a quote.', 'wconvert'),
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Alex Morgan', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'interest_label' => __('Which service do you need? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a service', 'wconvert'),
        // A structured list is one Role's value, not a list of repeated Roles.
        'interest_options' => [
            'options' => [
                ['value' => 'installation', 'label' => __('Installation', 'wconvert')],
                ['value' => 'repair', 'label' => __('Repair', 'wconvert')],
            ],
        ],
        'cta_label' => __('Request a quote', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('I agree to be contacted about my request. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('We use these details to respond to your request. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you for getting in touch. We have received your quote request.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
    // A type hint only: prefill never picks a shared destination or list.
    'destination_hint' => [
        'types' => ['mailpoet'],
        'fields' => ['email', 'interest'],
    ],
];
