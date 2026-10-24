<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-breakfast-edit',
    'name' => __('Breakfast Edit', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-breakfast-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('KITCHEN SEASONAL SALE', 'wconvert-pro'), 'headline' => __('BRIGHT MORNINGS.
25% LESS.', 'wconvert-pro'), 'body' => ['text' => __('Save on selected kitchen and breakfast essentials.', 'wconvert-pro')], 'cta_label' => __('Shop breakfast', 'wconvert-pro'), 'fine_print' => ['text' => __('25% off selected kitchenware. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
