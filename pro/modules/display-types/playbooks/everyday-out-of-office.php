<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-out-of-office',
    'name' => __('Out of office', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-out-of-office',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('Elsewhere / spring escapes', 'wconvert-pro'), 'headline' => __('Your out-of-office starts here.', 'wconvert-pro'), 'body' => ['text' => __('15% off selected stays booked by 31 October 2026.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Find my escape', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
