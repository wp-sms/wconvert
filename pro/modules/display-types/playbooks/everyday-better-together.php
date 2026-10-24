<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-better-together',
    'name' => __('Better together', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-better-together',
    'notes' => __('Set the action link and review the offer wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The good pair edit', 'wconvert-pro'), __('Two good reasons', 'wconvert-pro')], 'headline' => [__('Some things
are better
together.', 'wconvert-pro'), __('2', 'wconvert-pro'), __('for £20', 'wconvert-pro')], 'body' => ['text' => __('Choose any two everyday socks for £20. A little comfort, doubled.', 'wconvert-pro')], 'cta_label' => __('Find my good pair', 'wconvert-pro'), 'fine_print' => ['text' => __('Selected socks. Pair offer applied at checkout.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
