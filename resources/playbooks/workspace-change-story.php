<?php

defined('ABSPATH') || exit;

return [
    'id' => 'workspace-change-story',
    'name' => __('See how a workspace changed', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'project-pair',
    'business_types' => ['services'],
    'notes' => __('Embed beside relevant portfolio content and add a working case-study URL. These original diagrams are a fictional layout study, not evidence of completed client work. Replace media and captions together with licensed project evidence, or keep the fictional label. Do not promise safety, access suitability or performance outcomes from the drawings.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('An illustrated layout study', 'wconvert'), __('Before', 'wconvert'), __('After', 'wconvert'), __('What changed', 'wconvert')],
        'headline' => __('Make room for the work.', 'wconvert'),
        'body' => [__('One fictional workspace. Two ways to arrange it.', 'wconvert'), __('A central desk and scattered storage divide the room.', 'wconvert'), __('A desk by the window and storage together along one wall.', 'wconvert'), __('Move the desk. Group the storage. Leave a clearer route through the room.', 'wconvert')],
        'cta_label' => __('Read the layout story', 'wconvert'),
        'fine_print' => __('Original fictional diagrams, not photographs of a completed customer project.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
