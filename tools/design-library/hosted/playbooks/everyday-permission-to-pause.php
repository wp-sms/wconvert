<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-permission-to-pause',
    'name' => __('Permission to pause', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-permission-to-pause',
    'notes' => __('Set the action link and review the offer wording.', 'wconvert'),
    'copy' => ['eyebrow' => __('Soft hours / the weekend edit', 'wconvert'), 'headline' => __('Do almost
nothing.', 'wconvert'), 'body' => ['text' => __('Slow mornings. Comfortable things. Meet our edit for making yourself at home.', 'wconvert')], 'cta_label' => __('Explore the slow edit', 'wconvert'), 'fine_print' => ['text' => __('No rush. Take a look when you are ready.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
