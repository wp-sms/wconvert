import type { OutcomeContract } from '../../../resources/admin/src/goals/outcome';

export const CAPTURE_OUTCOME: OutcomeContract = {
  audience_channel: 'email',
  action: 'submit', capture_any_of: ['email'], requirement: 'Use a form with a required email field before publishing.',
  measurement: 'Counts email submissions, not confirmed subscribers.', proof_level: 'captured', destination_type: null, link_required: false,
};
export const CLICK_OUTCOME: OutcomeContract = {
  audience_channel: null,
  action: 'click', capture_any_of: [], requirement: 'Use a design whose button links to your offer before publishing.',
  measurement: 'Counts offer clicks, not purchases.', proof_level: 'on_site_action', destination_type: null, link_required: true,
};
