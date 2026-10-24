<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-tech-price-sheet',
    'name' => __('Tech Price Sheet', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-tech-price-sheet',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / EVERYDAY TECH SALE', 'wconvert'), __('SAMPLE ITEM', 'wconvert')], 'headline' => __('SMALL UPGRADE.
BIG DIFFERENCE.', 'wconvert'), 'body' => [['text' => __('WAS $120', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('$84', 'wconvert')]], 'badge' => __('30% OFF', 'wconvert'), 'cta_label' => __('Shop tech deals', 'wconvert'), 'fine_print' => ['text' => __('Example item reduced from $120 to $84. Nov 27–30.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
