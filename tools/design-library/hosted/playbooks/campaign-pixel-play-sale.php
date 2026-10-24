<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-pixel-play-sale',
    'name' => __('Pixel Play Sale', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-pixel-play-sale',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Place the campaign with its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => __('SELECTED GAMING & DESK ACCESSORIES', 'wconvert'), 'headline' => __('LEVEL UP.
SPEND 30% LESS.', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('30%', 'wconvert')], ['text' => __('Save on selected gaming and desk accessories.', 'wconvert')]], 'cta_label' => __('Shop gaming accessories', 'wconvert'), 'fine_print' => ['text' => __('30% off selected accessories. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
