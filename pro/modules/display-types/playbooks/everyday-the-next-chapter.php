<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-the-next-chapter',
    'name' => __('The next chapter', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-next-chapter',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The next chapter / author’s notebook', 'wconvert-pro'), __('A new novel', 'wconvert-pro'), __('The opening chapter', 'wconvert-pro'), __('The next chapter / author’s notebook', 'wconvert-pro'), __('A new novel', 'wconvert-pro'), __('The opening chapter', 'wconvert-pro')], 'headline' => [__('A story
is a door.', 'wconvert-pro'), __('01', 'wconvert-pro'), __('01', 'wconvert-pro')], 'body' => [['text' => __('Come inside the writing process. Read a free opening chapter and occasional notes from the author.', 'wconvert-pro')], ['text' => __('Every beginning
holds a possibility.', 'wconvert-pro')], ['text' => __('Every beginning
holds a possibility.', 'wconvert-pro')]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Open the first chapter', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('The door is open.', 'wconvert-pro'), 'success_body' => ['text' => __('Your chapter request is received. Read the sample opening below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
