<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-fifty-fifty-poster',
    'name' => __('Fifty-Fifty Poster', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-fifty-fifty-poster',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / STOREWIDE PROMOTION', 'wconvert'), __('UP TO', 'wconvert'), __('BLACK FRIDAY / SELECTED FAVOURITES', 'wconvert')], 'body' => ['text' => __('%b', 'wconvert'), 'emphasis' => __('50%', 'wconvert')], 'headline' => __('THE PRICE
IS THE POINT.', 'wconvert'), 'cta_label' => __('Shop Black Friday', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
