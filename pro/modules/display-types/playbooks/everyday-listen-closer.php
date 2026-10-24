<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-listen-closer',
    'name' => __('Listen closer', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-listen-closer',
    'notes' => __('Set the action link and review the offer wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('On the record', 'wconvert-pro'), 'body' => [['text' => __('Episode 12', 'wconvert-pro')], ['text' => __('A conversation about creative second acts.', 'wconvert-pro')]], 'headline' => __('The art of starting again.', 'wconvert-pro'), 'cta_label' => __('Listen to the episode', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
