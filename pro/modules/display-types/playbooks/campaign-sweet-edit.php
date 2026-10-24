<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-sweet-edit',
    'name' => __('Sweet Edit', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-sweet-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['body' => ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('25%', 'wconvert-pro')], 'eyebrow' => __('SELECTED TREATS & GIFT BOXES', 'wconvert-pro'), 'headline' => __('SWEET PICKS.
25% OFF.', 'wconvert-pro'), 'cta_label' => __('Shop the sweet edit', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
