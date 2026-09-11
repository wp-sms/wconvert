<?php

/**
 * "Grow my email list" — the ask a reader has already earned.
 *
 * The only entry under this [[Goal]] that interrupts nothing at all: it is an
 * `inline` [[Optin]], so it appears where the merchant placed the block and
 * never over the page. A reader who has reached the end of an article has
 * demonstrated the interest the other two entries have to guess at.
 *
 * `page_load` and not `scroll_depth`, which looks wrong and is not: an inline
 * Optin is already at the foot of the article, so a visitor cannot see it
 * without having scrolled there. A scroll Trigger on top of that is a second
 * spelling of the placement, and one the merchant can accidentally set past
 * the block's own position — at which point it never appears at all.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'article-end-newsletter',
    'name' => __('At the end of the article', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'inline-signup',
    'notes' => __('Sits in the page rather than over it, so nobody has to close anything. Place the block at the foot of your posts: a reader who got that far has already told you they are interested, which is why this asks for nothing but an address.', 'wconvert'),
    'copy' => [
        'headline' => __('More like this, every Thursday', 'wconvert'),
        'body' => __('One email a week with the new posts and nothing else.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send it to me', 'wconvert'),
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Unsubscribe in one click, any time. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Thanks for reading', 'wconvert'),
        'success_body' => __('We have received your request for the weekly round-up.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
    /*
     * `singular` names a post TYPE and not a post, which is what makes it
     * expressible here at all: `post` and `term` are marked `authored` in the
     * rule manifest because an id names a row only one site has, and `post` is
     * the same word on every WordPress there is.
     */
    'targeting' => [
        'include' => [
            ['type' => 'singular', 'value' => 'post'],
        ],
    ],
    'destination_hint' => [
        'types' => ['wsms', 'email_service_provider'],
        'fields' => ['email'],
    ],
];
