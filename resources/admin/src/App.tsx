import { __ } from '@wordpress/i18n';
import { GoalScreen } from './goals/GoalScreen';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { TemplatePreview } from './templates/TemplatePreview';

/**
 * The WConvert admin screen.
 *
 * The goal-first creation flow, the Optin list, the lead log and the Template
 * gallery. The builder and the analytics screen each arrive in their own
 * ticket.
 */
export function App() {
  return (
    <div className="wconvert-admin">
      <h1>{__('WConvert', 'wconvert')}</h1>
      <GoalScreen />
      <OptinList />
      <LeadLog />
      <TemplatePreview />
    </div>
  );
}
