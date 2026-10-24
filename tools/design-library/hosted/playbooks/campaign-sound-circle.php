<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-sound-circle',
    'name' => __('Sound Circle', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-sound-circle',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / AUDIO MARKDOWN', 'wconvert'), 'headline' => __('TURN
IT
UP.', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('35%
OFF', 'wconvert')], ['text' => __('Better sound.
A better Black Friday price.', 'wconvert')]], 'cta_label' => __('Shop audio', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
