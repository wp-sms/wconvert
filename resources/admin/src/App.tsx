import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft, Plus } from 'lucide-react';
import { OptinBuilder } from './builder/OptinBuilder';
import { GoalScreen } from './goals/GoalScreen';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { Dashboard } from './stats/Dashboard';
import { Destinations } from './destinations/Destinations';
import { Button } from './components/ui/button';
import { Shell } from './shell/Shell';
import { NarrowScreenNotice } from './shell/NarrowScreenNotice';
import { useBuilderViewport } from './hooks/useBuilderViewport';
import { sectionFrom, type SectionId } from './nav';

/**
 * The WConvert admin screen.
 *
 * **One section at a time, and the builder replaces even the tabs.** The
 * builder is a place a merchant sits down with; everything else is a list or a
 * report they read in passing, and the two do not belong on one page. That
 * distinction was always the design — what was missing until #62 is the nav
 * the v1 map decided ("conventional nav in v1"), without which the four
 * reading screens were one scroll and the create flow sat permanently on top
 * of them.
 *
 * Creating an Optin still lands IN the builder, which is what the goal-first
 * flow has always described: pick a [[Goal]], pick a [[Playbook]] under it,
 * land in an editor holding a prefilled Optin. What changed is where that flow
 * starts from — a button on the Optin list rather than the top of every visit.
 *
 * **The frame is WConvert's as of ADR 0035** and the hash router underneath it
 * is #62's, unchanged. `nav.ts` was always the load-bearing half of that
 * ticket; the `nav-tab` strip it fed was scaffolding, and {@see Shell} is what
 * replaced it.
 */
export function App() {
  const [editing, setEditing] = useState<string | null>(null);
  /*
   * Held here rather than inside {@see OptinsSection} because the button that
   * starts creation now sits in the page header, which is the frame's. The
   * state and the control that sets it belong on the same side of that line —
   * the alternative is a button in the header reaching into a child's state,
   * which is the shape that quietly grows a context.
   */
  const [creating, setCreating] = useState(false);
  const [section, setSection] = useState<SectionId>(() =>
    sectionFrom(typeof window === 'undefined' ? '' : window.location.hash),
  );

  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" />
      {__('Create an Optin', 'wconvert')}
    </Button>
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
    return <BuilderScreen id={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <Shell section={section} actions={section === 'optins' && !creating ? createButton : undefined}>
      <div className="wconvert-legacy">
        {section === 'optins' && (
          <OptinsSection
            creating={creating}
            onCancelCreate={() => setCreating(false)}
            onEdit={setEditing}
          />
        )}
        {section === 'analytics' && <Dashboard />}
        {section === 'leads' && <LeadLog />}
        {section === 'destinations' && <Destinations />}
      </div>
    </Shell>
  );
}

/**
 * The builder, or the sentence that stands where it would.
 *
 * **The gate is here rather than inside {@see OptinBuilder}**, so a viewport
 * too narrow for the builder does not mount it: the panel fetches a template,
 * renders a live preview through the renderer the loader imports and sticks it
 * to the scroll, none of which is work worth doing behind a message saying it
 * cannot be shown.
 *
 * **That saves the WORK and not the BYTES.** The import above is static, so
 * the builder and the renderer it pulls are in the bundle whatever this
 * decides — which is also why the size printed by every build is the unsplit
 * number. Making it a lazy boundary is
 * [#73](https://github.com/navidkashani/wconvert/issues/73), and it is not a
 * one-line change: the admin is built as an IIFE, and IIFE cannot code-split.
 */
function BuilderScreen({ id, onClose }: { id: string; onClose: () => void }) {
  const fits = useBuilderViewport();

  if (!fits) {
    /*
     * The way out is rendered HERE and only here, because {@see OptinBuilder}
     * draws its own and it is not on screen. Two back buttons is what the
     * first version of this shipped.
     */
    return (
      <Shell>
        <Button variant="ghost" size="sm" className="mb-4 -ms-3" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />
          {__('All Optins', 'wconvert')}
        </Button>
        <NarrowScreenNotice />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="wconvert-legacy">
        <OptinBuilder id={id} onClose={onClose} />
      </div>
    </Shell>
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
 *
 * The button itself now lives in the page header — a screen's primary action
 * beside the screen's name, rather than floating above the table it does not
 * act on.
 */
function OptinsSection({
  creating,
  onCancelCreate,
  onEdit,
}: {
  creating: boolean;
  onCancelCreate: () => void;
  onEdit: (id: string) => void;
}) {
  if (creating) {
    return (
      <>
        <Button variant="ghost" size="sm" className="mb-4 -ms-3" onClick={onCancelCreate}>
          <ArrowLeft aria-hidden="true" />
          {__('All Optins', 'wconvert')}
        </Button>
        <GoalScreen
          onCreated={(id) => {
            onCancelCreate();
            onEdit(id);
          }}
        />
      </>
    );
  }

  return <OptinList onEdit={onEdit} />;
}
