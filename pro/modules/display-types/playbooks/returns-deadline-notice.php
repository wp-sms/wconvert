<?php

defined('ABSPATH') || exit;

return [
    'id' => 'returns-deadline-notice',
    'name' => __('Read the current returns policy', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'inline-signpost',
    'business_types' => ['stores'],
    'notes' => __('Link directly to your current returns policy from relevant seasonal collection or product pages. Exclude the policy page, basket and checkout. Confirm eligibility, exceptions and any seasonal dates on the destination page; this setup creates no deadline or extended return period. Review placement beside sticky navigation and keep dismissal available.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('Seasonal shopping', 'wconvert-pro'),
        'headline' => __('Check returns before you buy.', 'wconvert-pro'),
        'cta_label' => __('Read returns policy', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 8]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
