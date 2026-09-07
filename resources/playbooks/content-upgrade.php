<?php

/**
 * "Deliver a lead magnet" — the resource that belongs to the post it sits in.
 *
 * A content upgrade is not a site-wide ebook: it is the checklist that goes
 * with *this* article, offered inside it. That specificity is the whole reason
 * it converts better than a general download, and it is why this entry is
 * `inline` and targeted at posts rather than being a popup on everything.
 *
 * ============================================================================
 * THE ONE THING IT CANNOT SAY IS WHICH POST, AND THAT IS CORRECT.
 * ============================================================================
 * `singular` names a post TYPE, and `post` is marked `authored` in the rule
 * manifest precisely because a post id names a row only one site has. So this
 * entry offers the merchant a starting point on all posts and they narrow it —
 * which is the same bargain the privacy link makes (ADR 0032) and the cart URL
 * makes: the plugin resolves what it can and asks for what only the site knows.
 *
 * `inline-split` rather than `centred-card`, which `guide-download` already
 * uses. Two entries under one [[Goal]] wearing the same design is the failure
 * this batch exists to fix, and the split's picture is where a merchant puts
 * the cover of the thing they are giving away.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'content-upgrade',
    'name' => __('The download for this article', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'inline-split',
    'notes' => __('A resource that belongs to one article, offered inside it — the checklist for this guide rather than a general ebook. That is what makes it convert: the reader is already interested in exactly this. Place the block partway through the post, and narrow the targeting to the posts the resource actually fits.', 'wconvert'),
    'copy' => [
        'headline' => __('Take the checklist with you', 'wconvert'),
        'body' => __('Everything on this page as a one-page PDF you can work through.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Email me the checklist', 'wconvert'),
        'success_headline' => __('On its way', 'wconvert'),
        'success_body' => __('Check your inbox. It should land in a minute or two.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
    'targeting' => [
        'include' => [
            ['type' => 'singular', 'value' => 'post'],
        ],
    ],
    'destination_hint' => [
        'types' => ['lead_magnet_email'],
        'fields' => ['email'],
    ],
];
