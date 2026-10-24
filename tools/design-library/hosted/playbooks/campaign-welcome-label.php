<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-welcome-label',
    'name' => __('Welcome Label', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-welcome-label',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Place the campaign with its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('WELCOME', 'wconvert'), __('YOUR FIRST ORDER', 'wconvert'), __('FIRST-ORDER COUPON', 'wconvert')], 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('10% OFF', 'wconvert')], ['text' => __('Save 10% on your first order of selected items.', 'wconvert')]], 'headline' => __('FIRST ORDER.
10% OFF.', 'wconvert'), 'cta_label' => __('Use my welcome offer', 'wconvert'), 'fine_print' => ['text' => __('New customers. Selected items; one use per customer.', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
