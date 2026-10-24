<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-free-delivery-label',
    'name' => __('Free-Delivery Label', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-free-delivery-label',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / FREE SHIPPING WEEKEND', 'wconvert-pro'), __('STANDARD / NOVEMBER 27–30', 'wconvert-pro')], 'body' => ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('$0', 'wconvert-pro')], 'headline' => __('DELIVERY
ON ORDERS $100+', 'wconvert-pro'), 'cta_label' => __('Shop with free delivery', 'wconvert-pro'), 'fine_print' => ['text' => __('Free standard shipping on orders $100+. Nov 27–30.', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
