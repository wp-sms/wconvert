<?php

/**
 * "Grow my SMS list" — a number given for first refusal, in the page.
 *
 * The second entry under this [[Goal]] and the one that does not interrupt:
 * `drop-alerts` is a popup after twelve seconds, and this is an `inline`
 * [[Optin]] a visitor meets where the merchant placed the block.
 *
 * One phone field keeps the request small. The terminal screen acknowledges
 * capture; delivery and opt-out handling belong to the configured SMS service.
 *
 * A phone number carries consent obligations an address does not, which is why
 * the fine print says what will actually be sent and how often, in the place a
 * visitor reads before they tap.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'vip-early-access',
    'name' => __('First refusal by text', 'wconvert'),
    'goal' => 'grow_sms_list',
    'template_id' => 'inline-phone',
    'notes' => __('Sits in the page instead of over it, so it suits a landing page or a product page better than a popup does. Asks only for a phone number. Configure the SMS service and opt-out handling before publishing. Say what you will send and how often — a phone number is a bigger ask than an address and people know it.', 'wconvert'),
    'copy' => [
        'headline' => __('First pick, before anyone else', 'wconvert'),
        'body' => __('We text the list the morning a new run goes up, and never at any other time.', 'wconvert'),
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'cta_label' => __('Text me first', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Send me text updates about new releases. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('About one message a month. Reply STOP to leave. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you for asking about first access to the next run.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
    'destination_hint' => [
        'types' => ['wsms'],
        'fields' => ['phone'],
    ],
];
