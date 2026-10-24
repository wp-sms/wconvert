<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-extra-gift',
    'name' => __('Extra Gift', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-extra-gift',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('GIFT WITH PURCHASE', 'wconvert'), 'headline' => __('ONE MORE REASON.
A GIFT ON US.', 'wconvert'), 'body' => ['text' => __('Receive a travel-size moisturizer with orders of $75 or more.', 'wconvert')], 'cta_label' => __('Shop the gift offer', 'wconvert'), 'fine_print' => ['text' => __('One gift per order. Subject to availability; selected products.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
