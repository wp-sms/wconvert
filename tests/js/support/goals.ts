import type { GoalEntry } from '../../../resources/admin/src/goals/api';
import type { OutcomeContract } from '../../../resources/admin/src/goals/outcome';

/** The Goal registry as `GET /goals` returns it, outcome by outcome (src/Goal/Goal.php). */
const goal = (id: string, label: string, outcome: Partial<OutcomeContract> & Pick<OutcomeContract, 'action'>): GoalEntry => ({
  id, label, description: '', headline_kind: 'conversion', headline_label: label, rate_label: label, tier: 'free', availability: 'ready',
  outcome: { capture_any_of: [], requirement: `${label} requirement`, measurement: '', proof_level: 'captured', destination_type: null, link_required: false, audience_channel: null, ...outcome },
});

export const GOALS: GoalEntry[] = [
  goal('grow_email_list', 'Grow my email list', { action: 'submit', capture_any_of: ['email'], audience_channel: 'email' }),
  goal('grow_sms_list', 'Grow my SMS list', { action: 'submit', capture_any_of: ['phone'], audience_channel: 'phone' }),
  goal('increase_basket_value', 'Increase basket value', { action: 'add_to_cart' }),
  goal('recover_cart', 'Bring shoppers back to their cart', { action: 'click' }),
  goal('promote_offer', 'Promote an offer or content', { action: 'click', link_required: true }),
  goal('show_message', 'Show a message', { action: 'none', proof_level: 'shown' }),
  goal('deliver_lead_magnet', 'Deliver a lead magnet', { action: 'submit', capture_any_of: ['email'], destination_type: 'lead_magnet_email' }),
  goal('collect_enquiries', 'Collect enquiries', { action: 'submit', capture_any_of: ['email', 'phone'] }),
  goal('find_match', 'Help visitors find a match', { action: 'match' }),
];
