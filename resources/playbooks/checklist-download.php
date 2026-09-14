<?php

/**
 * "Deliver a lead magnet" — the one that asks for a name, and says why.
 *
 * The third entry under this [[Goal]] and the only one that asks for two
 * things. That costs conversions and is worth it in exactly one case: when the
 * thing being delivered is addressed to a person and the follow-up sequence
 * uses the name. If a merchant is not going to use it, they should start from
 * `guide-download` instead, and the notes say so.
 *
 * Twenty seconds rather than `guide-download`'s scroll Trigger, because the two
 * are answering different questions about the same visitor: scroll asks *how
 * far have you read*, and a timer asks *are you still here*. A long resource
 * page is scrolled quickly by somebody skimming it.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'checklist-download',
    'name' => __('Download with name and email', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'name-and-email',
    'notes' => __('Asks for a first name as well as an address. Only pick this if you will use the name in the delivery email or follow-ups. Configure a delivery destination and add the guide before publishing.', 'wconvert'),
    'copy' => [
        'headline' => __('The forty-page guide, free', 'wconvert'),
        'body' => __('Everything we know about getting started, in one PDF.', 'wconvert'),
        'name_label' => __('First name', 'wconvert'),
        'name_placeholder' => __('Alex', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send me the guide', 'wconvert'),
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('We will send the guide and occasional follow-ups. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request for the guide.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 20],
    ],
    'destination_hint' => [
        'types' => ['lead_magnet_email'],
        'fields' => ['name', 'email'],
    ],
];
