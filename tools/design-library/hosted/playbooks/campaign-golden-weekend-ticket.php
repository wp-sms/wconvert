<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-golden-weekend-ticket',
    'name' => __('Golden Weekend Ticket', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-golden-weekend-ticket',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / PUBLIC COUPON OFFER', 'wconvert'), __('YOUR WEEKEND CODE', 'wconvert')], 'headline' => [__('ADMIT ONE.', 'wconvert'), __('SAVE BIG.', 'wconvert')], 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('35', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('%', 'wconvert')], ['text' => __('Enter at checkout.
Selected items only.', 'wconvert')]], 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')], 'cta_label' => __('Shop with this code', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
