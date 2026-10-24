<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-welcome-shortcut',
    'name' => __('Welcome Shortcut', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-welcome-shortcut',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('15%', 'wconvert')], ['text' => __('Start with a little saving. Enter the code below on your first order.', 'wconvert')]], 'eyebrow' => __('FIRST-ORDER COUPON', 'wconvert'), 'headline' => __('YOUR SHORTCUT
TO 15% OFF.', 'wconvert'), 'cta_label' => __('Use my welcome offer', 'wconvert'), 'fine_print' => ['text' => __('First order only. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
