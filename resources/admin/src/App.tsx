import { __ } from '@wordpress/i18n';

/**
 * The WConvert admin screen.
 *
 * A placeholder that proves the whole chain — Vite build, PHP enqueue, React
 * mount — is wired end to end. The Optin list, the goal-first creation flow and
 * the analytics screen each arrive in their own ticket.
 */
export function App() {
  return (
    <div className="wconvert-admin">
      <h1>{__('WConvert', 'wconvert')}</h1>
      <p>{__('Lead capture and conversion display for WordPress.', 'wconvert')}</p>
    </div>
  );
}
