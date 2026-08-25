import { __ } from '@wordpress/i18n';
import { OptinList } from './optins/OptinList';
import { TemplatePreview } from './templates/TemplatePreview';

/**
 * The WConvert admin screen.
 *
 * One list, and the thinnest form that can put an Optin into it. The
 * goal-first creation flow, the builder and the analytics screen each arrive
 * in their own ticket.
 */
export function App() {
  return (
    <div className="wconvert-admin">
      <h1>{__('WConvert', 'wconvert')}</h1>
      <OptinList />
      <TemplatePreview />
    </div>
  );
}
