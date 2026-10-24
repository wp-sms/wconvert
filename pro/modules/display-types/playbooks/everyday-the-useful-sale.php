<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-useful-sale',
    'name' => __('The useful sale', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-the-useful-sale',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The useful sale', 'wconvert-pro'), __('This week only', 'wconvert-pro')], 'headline' => [__('25%', 'wconvert-pro'), __('Less to spend.
More to use.', 'wconvert-pro')], 'fine_print' => [['text' => __('Selected everyday essentials.', 'wconvert-pro')], ['text' => __('Offer ends 31 October 2026. Exclusions apply.', 'wconvert-pro')]], 'body' => ['text' => __('Thoughtfully chosen things for your everyday. Shop selected pieces for less.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop the useful sale', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
