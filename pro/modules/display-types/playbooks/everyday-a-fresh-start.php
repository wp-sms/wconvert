<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-a-fresh-start',
    'name' => __('A fresh start', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-a-fresh-start',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['headline' => [__('15%', 'wconvert-pro'), __('A fresh start, on us.', 'wconvert-pro')], 'body' => ['text' => __('Selected everyday essentials. Ends 31 October.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop the fresh-start edit', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
