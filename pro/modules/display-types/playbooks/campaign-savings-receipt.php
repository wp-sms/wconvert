<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-savings-receipt',
    'name' => __('Savings Receipt', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-savings-receipt',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('CLEARANCE SALE', 'wconvert-pro'), 'headline' => __('LESS TO PAY.
MORE TO KEEP.', 'wconvert-pro'), 'body' => [['text' => __('ORIGINAL PRICE', 'wconvert-pro')], ['text' => __('100%', 'wconvert-pro')], ['text' => __('YOUR DISCOUNT', 'wconvert-pro')], ['text' => __('−30%', 'wconvert-pro')], ['text' => __('YOU SAVE', 'wconvert-pro')], ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('30%', 'wconvert-pro')]], 'cta_label' => __('Shop with 30% off', 'wconvert-pro'), 'fine_print' => ['text' => __('Selected clearance items. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
