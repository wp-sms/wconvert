<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-before-the-drop',
    'name' => __('Before the drop', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-before-the-drop',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('Edition 02 / the next release', 'wconvert-pro'), 'headline' => __('Good things on the horizon.', 'wconvert-pro'), 'body' => ['text' => __('Preview the new collection before it arrives.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Explore the next release', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
