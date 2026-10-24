<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-archive',
    'name' => __('Black Friday Archive', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-archive',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / THE ARCHIVE EVENT', 'wconvert'), __('BLACK FRIDAY / ARCHIVE CLEARANCE', 'wconvert'), __('SELECTED ARCHIVE', 'wconvert')], 'headline' => __('OUT OF THE ARCHIVE.
UP TO 60% OFF.', 'wconvert'), 'body' => [['text' => __('Past-season favorites return at Black Friday prices.', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('60%', 'wconvert')], ['text' => __('UP TO / OFF', 'wconvert')], ['text' => __('NOVEMBER 27–30', 'wconvert')]], 'cta_label' => __('Shop the archive sale', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected archive pieces and sizes.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
