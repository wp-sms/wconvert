<?php

/**
 * "Grow my email list" — the ask a reader has already earned, over the page.
 *
 * ============================================================================
 * IT WAS AN EXIT-INTENT ENTRY FOR ABOUT AN HOUR, AND IT MAY NOT BE ONE.
 * ============================================================================
 * The obvious design for *"catch them as they leave"* is `exit_intent`, and it
 * is unavailable here for a reason worth writing down rather than rediscovering:
 * a bundled [[Playbook]] may name a premium rule only where its [[Goal]]
 * already demands the same tier ({@see \WConvert\Tests\Unit\Playbook\BundledPlaybooksTest}).
 * `cart-on-the-way-out` may, because the cart Goal is `tier: pro`; this Goal is
 * free, so an entry naming it would be prefilled onto free installs.
 *
 * **The rule manifest's `substitute` is not a way round that.** It declares
 * `{time_on_page, 15}` for `exit_intent`, so the Optin would fire — which is
 * exactly the problem. A card advertising *"waits until they are leaving"* that
 * silently becomes a fifteen-second timer is a card that quietly turned into a
 * different card, and the merchant is never told. Substitution exists so an
 * Optin a merchant BUILT keeps working when a licence lapses, not so a bundled
 * card can promise a feature the install does not have.
 *
 * So this entry is named for the moment it can actually detect. Ninety per cent
 * is a reader who reached the end, which is a stronger signal of interest than
 * a timer anyway — a timer counts a tab left open.
 *
 * It differs from the other three under this Goal on every axis that matters:
 * `welcome-discount` trades a discount after eight seconds, `one-line-invite`
 * asks for nothing at sixty per cent, and `article-end-newsletter` sits in the
 * page rather than over it.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'read-to-the-end',
    'name' => __('When they have read it all', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'split-hero',
    'notes' => __('Waits until a reader has reached the bottom of the page, so it never interrupts anyone mid-sentence. Somebody who read to the end is the warmest audience on your site, which is why this one can afford to ask for something in return.', 'wconvert'),
    'copy' => [
        'headline' => __('Liked this? There is more.', 'wconvert'),
        'body' => __('Join the list and take 10% off your first order while you are here.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send my code', 'wconvert'),
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('One email a week at most. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Check your inbox', 'wconvert'),
        'success_body' => __('Your code is on its way. It works on your first order.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'scroll_depth', 'percent' => 90],
    ],
    /*
     * Signed-in visitors are excluded because on most sites they are already
     * customers, and a first-order discount shown to somebody who has already
     * ordered is the offer working against itself. `logged_in` is a boolean and
     * names nothing site-local, unlike `role`, which would.
     */
    'targeting' => [
        'exclude' => [
            ['type' => 'logged_in', 'value' => true],
        ],
    ],
    'destination_hint' => [
        'types' => ['wsms', 'email_service_provider'],
        'fields' => ['email'],
    ],
];
