<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-friday-comic',
    'name' => __('Friday Comic', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-friday-comic',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('THE FRIDAY EDIT / BLACK FRIDAY / NOV 27–30', 'wconvert'), __('YOUR WISHLIST…', 'wconvert')], 'body' => ['text' => __('YES.', 'wconvert')], 'headline' => __('PLOT TWIST:
30% OFF.', 'wconvert'), 'badge' => __('SELECTED FAVOURITES', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')], 'cta_label' => __('Shop the Friday sale', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
