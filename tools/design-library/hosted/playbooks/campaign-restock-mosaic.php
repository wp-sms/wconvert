<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-restock-mosaic',
    'name' => __('Restock Mosaic', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-restock-mosaic',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / PERSONAL-CARE ESSENTIALS SALE', 'wconvert'), 'headline' => __('RESTOCK.
REPEAT.', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('30% OFF', 'wconvert')], ['text' => __('The everyday essentials you’ll be glad you stocked up on.', 'wconvert')]], 'cta_label' => __('Shop care essentials', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
