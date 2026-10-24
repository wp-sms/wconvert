<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-streetwear-poster',
    'name' => __('Streetwear Poster', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-streetwear-poster',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('EVERYDAY / DROP 027 · 27—30 NOVEMBER', 'wconvert'), __('THE BIG FIT EVENT', 'wconvert'), __('UP TO / OFF', 'wconvert')], 'headline' => __('BLACK FRIDAY', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('40', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('%', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('GOOD FITS.
BETTER PRICES.', 'wconvert')], ['text' => __('Selected fleeces, layers
and everyday favorites.', 'wconvert')]], 'cta_label' => __('Shop the Black Friday drop', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
