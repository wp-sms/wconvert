<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-savings-staircase',
    'name' => __('Savings Staircase', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-savings-staircase',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / TIERED SPEND AND SAVE', 'wconvert'), __('SPEND $100', 'wconvert'), __('SPEND $200', 'wconvert'), __('SPEND $300', 'wconvert')], 'headline' => __('YOUR LIST GOES UP.
YOUR TOTAL GOES DOWN.', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('15%', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('20%', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('25%', 'wconvert')], ['text' => __('OFF YOUR ORDER
Highest eligible tier applies. Selected items.', 'wconvert')]], 'cta_label' => __('Shop and save', 'wconvert'), 'fine_print' => ['text' => __('Highest eligible tier applies. Selected items; discounts do not combine.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
