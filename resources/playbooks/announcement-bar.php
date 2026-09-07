<?php

/**
 * "Promote an offer" — the announcement that captures nothing.
 *
 * Click-metered, so there is no form, no [[Lead]], no [[Consent Record]] and no
 * [[Destination]]. What it counts is visitors who clicked through to the thing
 * being announced, which is the only honest measure of an announcement.
 *
 * ============================================================================
 * IT IS `inline` AND NOT A FLOATING BAR, AND THAT IS A CONSTRAINT ON PLAYBOOKS
 * RATHER THAN A DESIGN PREFERENCE.
 * ============================================================================
 * The obvious design for this is `bar-announcement`, which is Pro's. A
 * [[Playbook]] is validated at REGISTRATION on every install, and a free
 * install's {@see \WConvert\Template\TemplateLibrary} does not hold Pro's
 * designs at all — so an entry naming one is refused as an unknown reference
 * and warned about on every free site that loads the admin.
 *
 * So a bundled Playbook names a free design, always. The merchant who has the
 * floating bar switches to it in the gallery, where the [[Slot Role]]s carry
 * the words across.
 *
 * The CTA carries a label and no `href`: the page being announced is
 * site-local, and a Playbook can express nothing site-local — so the merchant
 * fills the destination in the settings panel, exactly as they do for the cart
 * link and the privacy policy.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'announcement-bar',
    'name' => __('A strip across the page', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'inline-cta',
    'notes' => __('Announces one thing and asks for nothing. Place the block near the top of your pages and set the button to point at the sale, the new range or whatever you are announcing. This Optin is measured by click-throughs, so nobody is added to a list and there is nothing to submit. If you have the floating bar, switch design in the gallery and your words come with you.', 'wconvert'),
    'copy' => [
        'headline' => __('Free delivery on everything this week', 'wconvert'),
        'body' => __('No minimum, no code needed.', 'wconvert'),
        'cta_label' => __('Shop the sale', 'wconvert'),
        'fine_print' => __('Ends Sunday at midnight.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
];
