<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-delivery-buddy',
    'name' => __('Delivery Buddy', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-delivery-buddy',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('SHIPPING THRESHOLD', 'wconvert'), 'headline' => __('GOOD NEWS.
FREE DELIVERY.', 'wconvert'), 'body' => ['text' => __('Get free standard shipping when your order reaches $75.', 'wconvert')], 'cta_label' => __('Shop essentials', 'wconvert'), 'fine_print' => ['text' => __('Orders $75+. Standard shipping to eligible destinations.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
