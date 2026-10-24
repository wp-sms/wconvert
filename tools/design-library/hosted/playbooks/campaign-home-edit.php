<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-home-edit',
    'name' => __('Home Edit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-home-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Place the campaign with its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / HOMEWARE SEASONAL SALE', 'wconvert'), __('01 / THE WEEKEND EDIT', 'wconvert'), __('SELECTED HOMEWARE', 'wconvert')], 'headline' => __('MAKE
ROOM.', 'wconvert'), 'body' => [['text' => __('A favorite corner. A better everyday. A Black Friday price.', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('30%', 'wconvert')], ['text' => __('OFF', 'wconvert')]], 'cta_label' => __('Shop the home edit', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
