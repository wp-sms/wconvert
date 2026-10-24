<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-open-atelier',
    'name' => __('Open atelier', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-open-atelier',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Open atelier / the annual studio sale', 'wconvert-pro'), __('Independent design, direct from the makers', 'wconvert-pro'), __('Studio sale closes in', 'wconvert-pro')], 'headline' => [__('Made with care.
Yours for less.', 'wconvert-pro'), __('20%', 'wconvert-pro')], 'body' => [['text' => __('20% off selected studio pieces. Objects with a story, ready for your everyday.', 'wconvert-pro')], ['text' => __('Off selected pieces', 'wconvert-pro')]], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Step inside the sale', 'wconvert-pro'), 'fine_print' => ['text' => __('Selected items. Ends 31 October 2026.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
