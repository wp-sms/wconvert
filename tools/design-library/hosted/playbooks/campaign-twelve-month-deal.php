<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-twelve-month-deal',
    'name' => __('Twelve-Month Deal', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-twelve-month-deal',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Place the campaign with its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / ANNUAL PLAN PROMOTION', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('MO', 'wconvert'), __('YOUR FIRST YEAR', 'wconvert')], 'headline' => __('12 MONTHS.
HALF THE PRICE.', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('01', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('02', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('03', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('04', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('05', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('06', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('07', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('08', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('09', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('10', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('11', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('12', 'wconvert')], ['text' => __('WAS $240', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('$120', 'wconvert')]], 'cta_label' => __('Choose annual', 'wconvert'), 'fine_print' => ['text' => __('New annual plans. First year $120. Renews at $240/year unless cancelled.', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
