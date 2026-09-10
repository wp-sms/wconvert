import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Plus } from 'lucide-react';
import { GoalScreen, OptinBuilder } from './builder/lazy';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { SiteAllowance } from './optins/SiteAllowance';
import { Dashboard } from './stats/Dashboard';
import { Destinations } from './destinations/Destinations';
import { Button } from './components/ui/button';
import { BackLink } from './shell/BuilderSkeleton';
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
   *
   * **It keeps running while the builder is open, and that is what makes Back
   * land somewhere.** The `editing !== null` branch below returns before
   * `section` is read, so for a while this looked like the reason Back did
   * nothing in the builder. It is not: the builder listens for the same event
   * and leaves through its own unsaved-changes guard ({@see OptinBuilder}),
   * which is where the guard lives and therefore where the listener has to be.
   * This one is what decides which section it lands on afterwards.
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
      {section === 'optins' && (
        <OptinsSection
          creating={creating}
          onCreate={() => setCreating(true)}
          onCancelCreate={() => setCreating(false)}
          onEdit={setEditing}
        />
      )}
      {section === 'analytics' && <Dashboard />}
      {section === 'leads' && <LeadLog />}
      {section === 'destinations' && <Destinations />}
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
 * **It now saves the BYTES as well, and that is #73.** The import above is
 * `builder/lazy`, not the builder — so the four reading screens never fetch
 * it, and neither does this arm: the chunk is requested when the boundary
 * mounts, and below 782px the boundary is never rendered at all. The saving
 * and the work now go together, where the gate used to buy only the second.
 *
 * The `Shell` is drawn HERE rather than inside the boundary, so the masthead
 * and the header band are on screen the instant the merchant clicks. Only the
 * inside of the page waits.
 *
 * **`wide` is set on this arm and nowhere else**, which is the whole of the
 * per-screen measure: the builder is the one screen that is a place rather than
 * a list, and 1440px is what buys it a tree, an inspector and a preview side by
 * side instead of one column with the controls below the fold. This branch
 * already renders a `Shell` of its own — `bareHeader` is the other thing only
 * the builder asks for — so it is one more prop on the call site that is
 * already the exception, rather than a new fork.
 *
 * The narrow arm above stays at the reading measure deliberately: it is a
 * sentence and a button, and there is nothing there to spend width on.
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
        <BackLink className="mb-4" onClose={onClose} />
        <NarrowScreenNotice />
      </Shell>
    );
  }

  return (
    <OptinBuilder id={id} onClose={onClose} />
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
  onCreate,
  onCancelCreate,
  onEdit,
}: {
  creating: boolean;
  onCreate: () => void;
  onCancelCreate: () => void;
  onEdit: (id: string) => void;
}) {
  if (creating) {
    return (
      <>
        {/*
          Above the region rather than inside it, because the way out of the
          flow is the PAGE's and not the flow's — it leaves the whole flow, so
          it cannot sit within the card the flow draws.

          This used to read "outside {@see Legacy}", naming the
          `.wconvert-legacy` wrapper that put it inside that card. The wrapper
          left with the last un-converted screen (ADR 0039) and the reference
          went dead with it; the placement it argued for is still the right
          one, so the reason is restated rather than deleted.
        */}
        <BackLink className="mb-4" onClose={onCancelCreate} />
        <GoalScreen
          onCreated={(id) => {
            onCancelCreate();
            onEdit(id);
          }}
        />
      </>
    );
  }

  /*
   * `onCreate` is the SAME door the page header opens, handed down so the
   * empty state can carry it. An empty screen whose only way forward is a
   * button in a band the merchant has already read past is an empty screen
   * with a dead end in it (ADR 0039).
   */
  /*
   * Two regions, because this screen holds two objects (ADR 0039). The list is
   * what exists; the allowance below it is how often a visitor may meet ANY of
   * them, which is a site-wide decision with no Optin to hang on and therefore
   * nowhere in the builder to live.
   */
  return (
    <div className="flex flex-col gap-5">
      <OptinList onEdit={onEdit} onCreate={onCreate} />
      <SiteAllowance />
    </div>
  );
}
