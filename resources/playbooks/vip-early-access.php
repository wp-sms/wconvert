<?php

/**
 * "Grow my SMS list" — a number given for first refusal, in the page.
 *
 * The second entry under this [[Goal]] and the one that does not interrupt:
 * `drop-alerts` is a popup after twelve seconds, and this is an `inline`
 * [[Optin]] a visitor meets where the merchant placed the block.
 *
 * ============================================================================
 * IT ASKS FOR A NAME AND A NUMBER, AND NOT FOR AN EMAIL FIRST.
 * ============================================================================
 * The research's shape for this is *"email micro-commitment → phone/consent →
 * coupon"* — a two-step form where the second step is optional. That is not
 * expressible: `steps[]` is keyed to the converting act, so a submit-metered
 * design has exactly two steps and the second is the terminal success state
 * (ADR 0025). There is no branch and no optional second page.
 *
 * So the trade is made honestly in one form instead. The name is what earns
 * the number: a text that opens with somebody's name is a different message
 * from one that does not, and asking for it is how this justifies a field that
 * would otherwise cost conversions for nothing.
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
    'notes' => __('Sits in the page instead of over it, so it suits a landing page or a product page better than a popup does. Asks for a name as well as a number, which costs a little and is what makes the messages worth receiving. Say what you will send and how often — a phone number is a bigger ask than an address and people know it.', 'wconvert'),
    'copy' => [
        'headline' => __('First pick, before anyone else', 'wconvert'),
        'body' => __('We text the list the morning a new run goes up, and never at any other time.', 'wconvert'),
        'name_label' => __('First name', 'wconvert'),
        'name_placeholder' => __('Alex', 'wconvert'),
        'phone_label' => __('Mobile number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900000', 'wconvert'),
        'cta_label' => __('Text me first', 'wconvert'),
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('About one message a month. Reply STOP to leave. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('You are on the list', 'wconvert'),
        'success_body' => __('We will text you the morning the next run goes up.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
    'destination_hint' => [
        'types' => ['wsms'],
        'fields' => ['name', 'phone'],
    ],
];
