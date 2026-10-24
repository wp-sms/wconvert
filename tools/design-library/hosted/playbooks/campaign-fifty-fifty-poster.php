<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-fifty-fifty-poster',
    'name' => __('Fifty-Fifty Poster', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-fifty-fifty-poster',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / SELECTED FAVOURITES', 'wconvert'), __('UP TO', 'wconvert'), __('BLACK FRIDAY / BIGGER SAVINGS', 'wconvert')], 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('50', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('%', 'wconvert')], ['text' => __('Selected collections.
Four days. One annual event.', 'wconvert')]], 'headline' => [__('THE PRICE', 'wconvert'), __('IS THE POINT.', 'wconvert')], 'cta_label' => __('Find your Friday deal', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
