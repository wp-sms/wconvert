<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-a-note-from-the-maker',
    'name' => __('A note from the maker', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-a-note-from-the-maker',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('A note from the maker', 'wconvert-pro'), __('A note from the maker', 'wconvert-pro')], 'headline' => __('Come behind
the scenes.', 'wconvert-pro'), 'body' => [['text' => __('I share what I’m making, what I’m learning and the pieces about to leave the studio. If that sounds like your kind of email, I’d love to write to you.', 'wconvert-pro')], ['text' => __('Alex, founder', 'wconvert-pro')], ['text' => __('Alex, founder', 'wconvert-pro')]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Send me the studio notes', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('Thank you for stopping by.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request for studio notes is received. It’s good to have your interest.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
