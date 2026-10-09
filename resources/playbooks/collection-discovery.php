<?php

defined('ABSPATH') || exit;

return [
    'id' => 'collection-discovery',
    'name' => __('Help undecided shoppers explore a collection', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'offer-panel',
    'business_types' => ['stores'],
    'notes' => __('Suggest the collection after visitors have spent time browsing. On a Pro site, consider desktop exit intent after reviewing the placement. Point to a useful collection page, not another interruption.', 'wconvert'),
    'copy' => [
        'headline' => __('Still looking for the right piece?', 'wconvert'),
        'body' => __('Explore the collection by material, size and use to find a useful starting point.', 'wconvert'),
        'cta_label' => __('Explore the collection', 'wconvert'),
        'fine_print' => __('Take another look at your own pace.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
