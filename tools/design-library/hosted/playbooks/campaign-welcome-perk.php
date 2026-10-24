<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-welcome-perk',
    'name' => __('Welcome Perk', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-welcome-perk',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('WELCOME COUPON', 'wconvert'), 'headline' => [__('YOUR FIRST', 'wconvert'), __('10% OFF.', 'wconvert')], 'body' => ['text' => __('A small welcome for your first order. Enter the code below at checkout.', 'wconvert')], 'cta_label' => __('Shop with 10% off', 'wconvert'), 'fine_print' => ['text' => __('New customers. Selected items; one use per customer.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
