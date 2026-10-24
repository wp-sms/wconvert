<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-turn-it-up',
    'name' => __('Turn It Up', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-turn-it-up',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / AUDIO SALE', 'wconvert'), 'headline' => __('BIG SOUND.
35% LESS.', 'wconvert'), 'body' => ['text' => __('Save 35% on selected headphones this Black Friday.', 'wconvert')], 'cta_label' => __('Shop audio', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected headphones.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
