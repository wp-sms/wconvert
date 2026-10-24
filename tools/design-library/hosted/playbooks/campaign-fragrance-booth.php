<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-fragrance-booth',
    'name' => __('Fragrance Booth', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-fragrance-booth',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('THE FRAGRANCE EDIT / BLACK FRIDAY', 'wconvert'), __('BLACK FRIDAY / FRAGRANCE SALE', 'wconvert')], 'headline' => __('YOUR SIGNATURE.
30% LESS.', 'wconvert'), 'body' => ['text' => __('Selected fragrances. A Black Friday price worth a closer look.', 'wconvert')], 'cta_label' => __('Shop the fragrance edit', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected fragrances.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
