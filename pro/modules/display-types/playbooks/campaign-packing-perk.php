<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-packing-perk',
    'name' => __('Packing Perk', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-packing-perk',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('PACKAGING SUPPLIES SALE', 'wconvert-pro'), 'headline' => __('PACK MORE.
PAY 25% LESS.', 'wconvert-pro'), 'cta_label' => __('Shop the packing perk', 'wconvert-pro'), 'fine_print' => ['text' => __('25% off selected packing supplies. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
