<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-layer-edit',
    'name' => __('Layer Edit', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-layer-edit',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY', 'wconvert-pro'), 'headline' => [__('LAYER UP.', 'wconvert-pro'), __('SPEND LESS.', 'wconvert-pro')], 'body' => ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('UP TO 40% OFF', 'wconvert-pro')], 'fine_print' => ['text' => __('Selected layers. November 27–30.', 'wconvert-pro')], 'cta_label' => __('Shop the layer edit', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
