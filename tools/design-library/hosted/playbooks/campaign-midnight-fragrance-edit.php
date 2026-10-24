<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-midnight-fragrance-edit',
    'name' => __('Midnight Fragrance Edit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-midnight-fragrance-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / FRAGRANCE SALE', 'wconvert'), 'headline' => __('A SIGNATURE SCENT.
30% LESS.', 'wconvert'), 'body' => [['text' => __('Selected fragrances, with a Black Friday price.', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('30%', 'wconvert')], ['text' => __('SELECTED FRAGRANCES', 'wconvert')]], 'cta_label' => __('Shop fragrance', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected fragrances.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
