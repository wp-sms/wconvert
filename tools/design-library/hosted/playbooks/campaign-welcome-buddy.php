<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-welcome-buddy',
    'name' => __('Welcome Buddy', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-welcome-buddy',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('FIRST-ORDER OFFER', 'wconvert'), 'headline' => __('FIRST ORDER.
15% LESS.', 'wconvert'), 'body' => ['text' => __('New here? Save 15% on your first order of selected everyday favorites.', 'wconvert')], 'cta_label' => __('Shop with 15% off', 'wconvert'), 'fine_print' => ['text' => __('First order only. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
