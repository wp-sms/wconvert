<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-sneaker-edit',
    'name' => __('Sneaker Edit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-sneaker-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / FOOTWEAR SALE', 'wconvert'), 'headline' => [__('NICE PAIR.', 'wconvert'), __('40% LESS.', 'wconvert')], 'body' => ['text' => __('Save 40% on selected sneakers this Black Friday.', 'wconvert')], 'cta_label' => __('Shop the sneaker sale', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected styles and sizes.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
