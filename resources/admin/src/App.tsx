import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { OptinBuilder } from './builder/OptinBuilder';
import { GoalScreen } from './goals/GoalScreen';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { Dashboard } from './stats/Dashboard';
import { Destinations } from './destinations/Destinations';
import { SECTIONS, hashFor, sectionFrom, type SectionId } from './nav';

/**
 * The WConvert admin screen.
 *
 * **One section at a time, and the builder replaces even the tabs.** The
 * builder is a place a merchant sits down with; everything else is a list or a
 * report they read in passing, and the two do not belong on one page. That
 * distinction was always the design — what was missing until now is the nav
 * the v1 map decided ("conventional nav in v1"), without which the four
 * reading screens were one scroll and the create flow sat permanently on top
 * of them.
 *
 * Creating an Optin still lands IN the builder, which is what the goal-first
 * flow has always described: pick a [[Goal]], pick a [[Playbook]] under it,
 * land in an editor holding a prefilled Optin. What changed is where that flow
 * starts from — a button on the Optin list rather than the top of every visit.
 */
export function App() {
  const [editing, setEditing] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>(() =>
    sectionFrom(typeof window === 'undefined' ? '' : window.location.hash),
  );

  /*
   * The browser is the source of truth for which section is open, so the back
   * button works without this screen keeping a history of its own. Listening
   * rather than only writing is the whole of it: a `pushState` nobody listens
   * to leaves Back changing the URL and nothing else.
   */
  useEffect(() => {
    const follow = () => setSection(sectionFrom(window.location.hash));

    window.addEventListener('hashchange', follow);

    return () => window.removeEventListener('hashchange', follow);
  }, []);

  if (editing !== null) {
    return (
      <div className="wconvert-admin">
        <OptinBuilder id={editing} onClose={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className="wconvert-admin">
      <h1 className="wp-heading-inline">{__('WConvert', 'wconvert')}</h1>

      {/*
        * WordPress's own `nav-tab` markup rather than a bespoke strip: four
        * sections is what tabs are for, and the classes carry the focus ring,
        * the active state and the responsive behaviour that a hand-rolled one
        * would have to re-earn. WSMS uses a sidebar because it has twenty-five
        * sections — that is a response to scale WConvert does not have.
        *
        * Real `href`s, so a tab is middle-clickable, copyable and reachable by
        * keyboard with nothing here re-implementing any of it. The click
        * handler is not what navigates; the hash change is, and the effect
        * above is what hears it.
        */}
      <nav className="nav-tab-wrapper wp-clearfix" aria-label={__('WConvert sections', 'wconvert')}>
        {SECTIONS.map((entry) => (
          <a
            key={entry.id}
            href={hashFor(entry.id)}
            className={`nav-tab${entry.id === section ? ' nav-tab-active' : ''}`}
            aria-current={entry.id === section ? 'page' : undefined}
          >
            {entry.label}
          </a>
        ))}
      </nav>

      {section === 'optins' && <OptinsSection onEdit={setEditing} />}
      {section === 'analytics' && <Dashboard />}
      {section === 'leads' && <LeadLog />}
      {section === 'destinations' && <Destinations />}
    </div>
  );
}

/**
 * The Optin list, with creation behind the button that starts it.
 *
 * **Not two doors into creation.** {@see OptinList} says in as many words that
 * it does not create an Optin, because a second door skipping the [[Goal]]
 * registry is the drift the registry exists to stop (ADR 0026). This keeps
 * that: the button opens the same goal-first flow, and the only thing it
 * changes is that the flow is not already open.
 */
function OptinsSection({ onEdit }: { onEdit: (id: string) => void }) {
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <>
        <button type="button" className="button button-link" onClick={() => setCreating(false)}>
          {__('← All Optins', 'wconvert')}
        </button>
        <GoalScreen
          onCreated={(id) => {
            setCreating(false);
            onEdit(id);
          }}
        />
      </>
    );
  }

  return (
    <>
      <p>
        <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
          {__('Create an Optin', 'wconvert')}
        </button>
      </p>
      <OptinList onEdit={onEdit} />
    </>
  );
}
