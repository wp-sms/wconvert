<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-friday-game-code',
    'name' => __('Friday Game Code', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-friday-game-code',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / GAMING ACCESSORIES COUPON', 'wconvert'), 'headline' => [__('MORE PLAY.', 'wconvert'), __('30% LESS.', 'wconvert')], 'body' => ['text' => __('Use the code below on selected gaming accessories.', 'wconvert')], 'cta_label' => __('Shop with my code', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected gaming accessories.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
