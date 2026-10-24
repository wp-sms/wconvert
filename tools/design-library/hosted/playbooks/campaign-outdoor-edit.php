<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-outdoor-edit',
    'name' => __('Outdoor Edit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-outdoor-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('OUTDOOR SEASONAL SALE', 'wconvert'), 'headline' => [__('MORE OUTSIDE.', 'wconvert'), __('30% LESS.', 'wconvert')], 'body' => ['text' => __('Save 30% on selected camping and outdoor essentials.', 'wconvert')], 'cta_label' => __('Shop the outdoor sale', 'wconvert'), 'fine_print' => ['text' => __('Selected outdoor gear. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
