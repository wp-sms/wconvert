import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { OptinBuilder } from './builder/OptinBuilder';
import { GoalScreen } from './goals/GoalScreen';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { Dashboard } from './stats/Dashboard';
import { Destinations } from './destinations/Destinations';

/**
 * The WConvert admin screen.
 *
 * One screen at a time, and the builder is the one that replaces the rest.
 * Everything else here is a list or a report a merchant reads in passing; the
 * builder is a thing they sit down with, and putting the gallery, the settings
 * panel and three rule axes beside a lead log would make both halves harder to
 * read.
 *
 * Creating an Optin lands IN the builder, which is what the goal-first flow
 * has always described: pick a [[Goal]], pick a [[Playbook]] under it, land in
 * an editor holding a prefilled Optin.
 */
export function App() {
  const [editing, setEditing] = useState<string | null>(null);

  if (editing !== null) {
    return (
      <div className="wconvert-admin">
        <OptinBuilder id={editing} onClose={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className="wconvert-admin">
      <h1>{__('WConvert', 'wconvert')}</h1>
      <GoalScreen onCreated={setEditing} />
      <OptinList onEdit={setEditing} />
      <Dashboard />
      <LeadLog />
      <Destinations />
    </div>
  );
}
