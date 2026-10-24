<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-restock-mosaic',
    'name' => __('Restock Mosaic', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-restock-mosaic',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / PERSONAL-CARE ESSENTIALS SALE', 'wconvert'), __('OFF SELECTED CARE', 'wconvert')], 'headline' => [__('RESTOCK.', 'wconvert'), __('REPEAT.', 'wconvert')], 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('30', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('%', 'wconvert')], ['text' => __('The everyday essentials you’ll be glad you stocked up on.', 'wconvert')]], 'cta_label' => __('Shop the Friday restock', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
