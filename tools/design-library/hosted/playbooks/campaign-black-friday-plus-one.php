<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-plus-one',
    'name' => __('Black Friday Plus One', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-plus-one',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / GIFT THRESHOLD', 'wconvert'), __('A TRAVEL-SIZE MOISTURISER', 'wconvert')], 'headline' => [__('YOUR BASKET.', 'wconvert'), __('PLUS ONE.', 'wconvert')], 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('+', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('ON US.', 'wconvert')], ['text' => __('With orders
of $75 or more.', 'wconvert')]], 'cta_label' => __('Shop the gift event', 'wconvert'), 'fine_print' => ['text' => __('Gift on orders $75+. One per order, subject to availability.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
