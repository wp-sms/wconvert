<?php

defined('ABSPATH') || exit;

return [
    'id' => 'weeknight-recipe-sample',
    'name' => __('Try a recipe before requesting the guide', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'recipe-clipping',
    'business_types' => ['publishers'],
    'notes' => __('Embed below a relevant recipe. Prepare the full recipe resource and delivery destination. Replace sample cooking guidance with tested recipes.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:sample' => [
                'eyebrow' => [
                    __('THE SMALL KITCHEN', 'wconvert'),
                    __('RECIPE 01', 'wconvert'),
                    __('IN THE TRAY', 'wconvert'),
                    __('THE IDEA', 'wconvert'),
                ],
                'headline' => __('Good things.
One tray.', 'wconvert'),
                'body' => [
                    __('A sample from our weeknight recipe collection.', 'wconvert'),
                    __('Chickpeas
Cherry tomatoes
Courgette
Olive oil & lemon', 'wconvert'),
                    __('Roast the vegetables and chickpeas until golden. Finish with lemon and serve with warm bread.', 'wconvert'),
                    __('The full guide includes quantities, timings and variations.', 'wconvert'),
                ],
                'next_label' => __('Request the full recipe collection', 'wconvert'),
            ],
            'submission:email' => [
                'eyebrow' => __('THE SMALL KITCHEN / YOUR COPY', 'wconvert'),
                'headline' => __('Five dinners.
A little less thinking.', 'wconvert'),
                'body' => __('Leave your email to request the recipe collection.', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'email_placeholder' => __('you@example.com', 'wconvert'),
                'consent_text' => __('Use my email to send the recipe collection.', 'wconvert'),
                'cta_label' => __('Request the recipes', 'wconvert'),
                'back_label' => __('Back to the sample', 'wconvert'),
                'fine_print' => __('A one-off recipe request. No newsletter signup.', 'wconvert'),
            ],
            'acknowledgement' => [
                'eyebrow' => __('THE SMALL KITCHEN / REQUEST', 'wconvert'),
                'success_headline' => __('Recipe request received', 'wconvert'),
                'success_body' => __('Thank you for requesting the collection. Your email has been recorded for this request.', 'wconvert'),
                'close_label' => __('Close', 'wconvert'),
            ],
        ],
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
