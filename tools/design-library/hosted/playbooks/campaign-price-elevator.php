<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-price-elevator',
    'name' => __('Price Elevator', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-price-elevator',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('EXAMPLE PRICE / 40% OFF', 'wconvert'), __('BLACK FRIDAY / PRICE MARKDOWN', 'wconvert')], 'body' => [['text' => __('WAS $100', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('$60', 'wconvert')], ['text' => __('Selected favorites are 40% off. A $100 item becomes $60.', 'wconvert')]], 'headline' => __('BLACK FRIDAY.
PRICE DROP.', 'wconvert'), 'cta_label' => __('Shop the savings', 'wconvert'), 'fine_print' => ['text' => __('Illustrative pricing. November 27–30. Selected items.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
