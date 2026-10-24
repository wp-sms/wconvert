<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-streetwear-poster',
    'name' => __('Streetwear Poster', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-streetwear-poster',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / APPAREL DROP', 'wconvert'), __('THE BIG FIT EVENT', 'wconvert')], 'headline' => __('BLACK FRIDAY', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('UP TO
40% OFF', 'wconvert')], ['text' => __('Selected fleeces, layers and everyday favourites.', 'wconvert')]], 'cta_label' => __('Shop the drop', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
