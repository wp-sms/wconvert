<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-paper-pine',
    'name' => __('Paper & pine', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-paper-pine',
    'notes' => __('Link to your seasonal gift edit or information page. Place the block or shortcode where this belongs.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE GIFT GUIDE', 'wconvert'), 'headline' => __('Less scrolling.
More thoughtful giving.', 'wconvert'), 'body' => __('Our considered Christmas gift guide, all in one place.', 'wconvert'), 'cta_label' => __('Explore the gift guide', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
