<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-friday-coupon',
    'name' => __('Friday Coupon', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-friday-coupon',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / PUBLIC DISCOUNT CODE', 'wconvert'), __('YOUR BLACK FRIDAY CODE', 'wconvert')], 'headline' => __('BLACK FRIDAY.
40% OFF.', 'wconvert'), 'body' => [['text' => __('Save 40% on selected favorites during the Black Friday event.', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('40%', 'wconvert')], ['text' => __('OFF SELECTED ITEMS', 'wconvert')]], 'cta_label' => __('Shop with 40% off', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
