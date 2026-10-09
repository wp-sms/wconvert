<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-fit-brief',
    'name' => __('Check whether a website review fits', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'scope-sheet',
    'business_types' => ['services'],
    'notes' => __('Embed beside the actual website-review description. Verify included work and exclusions, and link the page to your full terms. Keep leads in WConvert only or a supported destination and assign someone to reply. Scope, price and timing are agreed separately; no booking or quotation is created.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A website review', 'wconvert'), __('What we review', 'wconvert'), __('Agreed separately', 'wconvert'), __('Request received', 'wconvert')],
        'headline' => [__('Know what you are asking for.', 'wconvert'), __('Clarity. Navigation. Next steps.', 'wconvert'), __('Changes to the website.', 'wconvert'), __('Start with a conversation.', 'wconvert')],
        'body' => [__('A focused look at the pages your customers use, with a written list of observations.', 'wconvert'), __('Design, development and ongoing support are separate work, with their own scope and price.', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Use my email to discuss this website review.', 'wconvert'),
        'cta_label' => __('Ask about the review', 'wconvert'),
        'fine_print' => __('We use your email to reply. Scope, price and timing are agreed before any work.', 'wconvert'),
        'success_headline' => __('Your enquiry is received.', 'wconvert'),
        'success_body' => __('Thank you. The next conversation can confirm which pages to review, the price and timing. No work is booked.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
