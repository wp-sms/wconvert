<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-garden-edit',
    'name' => __('Garden Edit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-garden-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Place the campaign with its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => __('GARDEN SEASONAL SALE', 'wconvert'), 'headline' => __('GROW MORE.
SPEND 25% LESS.', 'wconvert'), 'body' => ['text' => __('Save on selected planters, tools and garden accessories.', 'wconvert')], 'cta_label' => __('Shop the garden sale', 'wconvert'), 'fine_print' => ['text' => __('25% off selected garden accessories. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
