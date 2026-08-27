import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionError, RegionErrorState } from '../shell/Region';
import { messageOf } from '../shell/loadable';
import { Gallery } from './Gallery';
import { DestinationsEditor } from './DestinationsEditor';
import { RulesEditor } from './RulesEditor';
import { SettingsPanel } from './SettingsPanel';
import { TargetingEditor, type Targeting } from './TargetingEditor';
import { getOptin, getRules, saveOptin, type Rule, type RuleVocabulary } from './api';
import { listTemplates, type Gallery as TemplateGallery, type TemplateEntry } from '../templates/api';
import { adminSettings } from '../settings';
import type { Template } from '@renderer/types';

/**
 * The builder: pick a design, adjust it, and set the rules that decide who
 * sees it and when.
 *
 * ============================================================================
 * FOUR SURFACES OVER ONE `config`, AND NONE OF THEM IS A NEW VOCABULARY.
 * ============================================================================
 * The gallery picks a [[Template]]; the settings panel edits the Optin's copy
 * of it; the rules editor edits the two client axes; the targeting picker
 * edits the server one. Everything they write is the same flat, closed
 * vocabulary the loader evaluates and the renderer draws (ADR 0005, ADR 0010)
 * — there is no builder-only field anywhere in this screen.
 *
 * **Nothing is saved as you type.** `config` is the working draft and
 * `published_config` is what the site is serving; they are separate columns so
 * that editing is not publishing. Publishing stays on the list beside the
 * Optin, which is where a merchant decides that what they have is ready.
 *
 * **Except picking a design, which saves at once.** That is the one edit that
 * is not a value in a field: it takes a fresh snapshot of the design and
 * carries the merchant's words across by [[Slot Role]], and the snapshot
 * boundary is the server's. Taking it at the click is what lets the panel
 * underneath show what was actually stored.
 *
 * ============================================================================
 * FIVE TABS, WHICH IS THE SHAPE ADR 0039 ANTICIPATED.
 * ============================================================================
 * It was one column: the gallery, then the whole settings panel, then three
 * editors, stacked. A merchant adjusting the fine print scrolled past every
 * design in the library to reach it, and the Save button was at the bottom of
 * all of it. Five surfaces over one `config` is five tabs — and ADR 0039 states
 * in as many words that these are *"a level below"* ADR 0036's four top-level
 * sections, so the two numbers are not in competition.
 *
 * **The name and Save are the page header's, not a tab's.** They act on the
 * whole Optin, so they sit above the tabs where they are reachable from every
 * one of them — which is the same placement rule every other screen follows
 * (ADR 0039). Save at the bottom of tab five would be a Save a merchant on tab
 * two cannot see.
 */

export interface OptinBuilderProps {
  readonly id: string;
  readonly onClose: () => void;
}

type Config = Record<string, unknown>;

/** The five surfaces, in the order a merchant meets them. */
type TabId = 'design' | 'content' | 'rules' | 'pages' | 'destinations';

export function OptinBuilder({ id, onClose }: OptinBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [vocabulary, setVocabulary] = useState<RuleVocabulary | null>(null);
  const [gallery, setGallery] = useState<TemplateGallery | null>(null);
  /*
   * A first read that fails leaves the builder with nothing to draw, so it is
   * held apart from `error` — which is what a SAVE reports, above a screen the
   * merchant is still working in. `Loadable` is not used here because there is
   * no "ready" arm to model: the three reads below gate on their own values
   * being non-null, and a fourth flag agreeing with them is a fourth thing to
   * keep in step.
   */
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<TabId>('design');

  const report = useCallback((cause: unknown) => setError(messageOf(cause)), []);

  useEffect(() => {
    getOptin(id)
      .then((optin) => {
        setName(optin.name);
        setConfig(optin.config);
      })
      .catch((cause: unknown) => setFatal(messageOf(cause)));
  }, [id]);

  // The rule vocabulary and the gallery are the install's, not the Optin's, so
  // they are fetched once and survive every edit below.
  useEffect(() => {
    getRules()
      .then(setVocabulary)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
    listTemplates()
      .then(setGallery)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
  }, []);

  const edit = (changes: Config) => {
    setConfig((current) => (current === null ? current : { ...current, ...changes }));
    setSaved(false);
  };

  const save = (next: Config = config ?? {}) => {
    setBusy(true);
    setError(null);

    return saveOptin(id, name, next)
      .then((optin) => {
        // The server's copy wins: it normalises against both vocabularies on
        // the way in, and a screen that kept its own would show a rule or a
        // node that was dropped at the boundary.
        setConfig(optin.config);
        setSaved(true);
      })
      .catch(report)
      .finally(() => setBusy(false));
  };

  if (fatal !== null) {
    return (
      <div className="flex flex-col gap-4">
        <BuilderBand>
          <BackLink onClose={onClose} />
        </BuilderBand>
        <Region label={__('Optin builder', 'wconvert')}>
          <RegionErrorState
            message={fatal}
            hint={__('Reload the page to try again.', 'wconvert')}
          />
        </Region>
      </div>
    );
  }

  if (config === null || vocabulary === null || gallery === null) {
    return (
      <div className="flex flex-col gap-4">
        <BuilderBand>
          <BackLink onClose={onClose} />
          <Skeleton className="mt-3 h-9 w-72 max-w-full" />
        </BuilderBand>
        <Region label={__('Optin builder', 'wconvert')}>
          <RegionBody className="flex flex-col gap-4">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-48 w-full" />
          </RegionBody>
        </Region>
      </div>
    );
  }

  const template = config.template as Template | undefined;
  const templateId = typeof config.template_id === 'string' ? config.template_id : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/*
        **The same band every other screen has.** The frame draws a page header
        for a section and the builder has none — it replaces even the section
        nav (#62) — so it draws its own, in the same place, on the same surface,
        with the same rule under it. The negative margins take it full-bleed out
        of `<main>`'s measure, which is what makes it read as the frame's band
        rather than as the first card on the page.
      */}
      <BuilderBand>
        <BackLink onClose={onClose} />

        {/*
          **A page needs a heading, and an `<input>` is not one.** The name is
          editable in place, which is right for the title of a thing you are
          building — but it left the document with no `h1` at all, on the one
          screen a merchant spends real time in. The visible title stays the
          field; the heading says the same words to anything reading structure.
        */}
        <h1 className="sr-only">{name === '' ? __('Untitled Optin', 'wconvert') : name}</h1>

        <div className="wconvert-page-actions mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor="wconvert-optin-name" className="sr-only">
            {__('Name', 'wconvert')}
          </label>
        {/*
          The name IS the title, so it is edited where the title stands rather
          than in a field labelled "Name" above the design. Borderless until it
          is focused, which is what says "this text is editable" without
          drawing a form on a screen that is not one.
        */}
          <input
            id="wconvert-optin-name"
            type="text"
            value={name}
            placeholder={__('Untitled Optin', 'wconvert')}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold leading-tight tracking-tight text-foreground hover:border-border focus:border-ring focus:bg-background focus:outline-none"
          />

          <Button disabled={busy} onClick={() => void save()}>
            {__('Save changes', 'wconvert')}
          </Button>

          {/*
            **"Saved" says where publishing happens.** Editing is not publishing
            — `config` is the draft and `published_config` is what the site
            serves — and a merchant who saved and saw nothing go live needs that
            sentence here rather than in a support reply.
          */}
          {saved && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Check aria-hidden="true" className="size-4 text-success" />
              {__('Saved. Publish it from the list when it is ready.', 'wconvert')}
            </span>
          )}
        </div>
      </BuilderBand>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
        <TabsList className="mb-4">
          <TabsTrigger value="design">{__('Design', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="content">{__('Content', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="rules">{__('Rules', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="pages">{__('Where it shows', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="destinations">{__('Destinations', 'wconvert')}</TabsTrigger>
        </TabsList>

        {error !== null && (
          <Region className="mb-4">
            <RegionError message={error} />
          </Region>
        )}

        <TabsContent value="design">
          <Region label={__('The design', 'wconvert')}>
            <RegionBody className="flex flex-col gap-4">
              <TabNote>
                {__('Picking one saves straight away, and carries your words across.', 'wconvert')}
              </TabNote>
              <Gallery
                templates={gallery.templates}
                displayType={displayTypeOf(config, gallery.templates)}
                chosen={templateId}
                busy={busy}
                onChoose={(chosen) => void save({ ...config, template_id: chosen })}
              />
            </RegionBody>
          </Region>
        </TabsContent>

        <TabsContent value="content">
          <Region label={__('What it says', 'wconvert')}>
            {template === undefined ? (
              <RegionBody className="text-muted-foreground">
                {__('Choose a design first — the Design tab is where the library is.', 'wconvert')}
              </RegionBody>
            ) : (
              <RegionBody className="wconvert-editor">
                <SettingsPanel
                  entry={entryFor(template, templateId, gallery.templates)}
                  labels={gallery.labels}
                  dev={adminSettings()?.dev === true}
                  onChange={(next) => edit({ template: next })}
                  onError={report}
                />
              </RegionBody>
            )}
          </Region>
        </TabsContent>

        <TabsContent value="rules">
          <Region label={__('Rules', 'wconvert')}>
            <RegionBody className="wconvert-editor">
              <RulesEditor
                triggers={vocabulary.triggers}
                conditions={vocabulary.conditions}
                rules={Array.isArray(config.rules) ? (config.rules as Rule[]) : []}
                onChange={(rules) => edit({ rules })}
              />
            </RegionBody>
          </Region>
        </TabsContent>

        <TabsContent value="pages">
          <Region label={__('Where it shows', 'wconvert')}>
            <RegionBody className="wconvert-editor">
              <TargetingEditor
                types={vocabulary.targeting}
                targeting={(config.targeting ?? {}) as Targeting}
                onChange={(targeting) => edit({ targeting })}
              />
            </RegionBody>
          </Region>
        </TabsContent>

        <TabsContent value="destinations">
          <Region label={__('Destinations', 'wconvert')}>
            <RegionBody className="wconvert-editor">
              <DestinationsEditor
                bound={Array.isArray(config.destinations) ? (config.destinations as string[]) : []}
                onChange={(destinations) => edit({ destinations })}
                onError={report}
              />
            </RegionBody>
          </Region>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * **The frame's own header band, filled by the builder.**
 *
 * The builder has no `section`, so the frame draws it no title — but it does
 * have a title of its own and an action that acts on the whole Optin, and those
 * belong in the same band on the same surface as every other screen's. Drawing
 * a lookalike inside `<main>` got the surface right and the width wrong: `main`
 * is a centred `max-w-6xl`, so the rule under the band stopped short of the
 * screen while every other screen's ran edge to edge. `Shell`'s `bareHeader`
 * renders the real band and {@see PageAction} puts this inside it.
 *
 * All three arms of the builder use it, so a slow load does not draw a header
 * that then moves when the real one replaces it.
 */
function BuilderBand({ children }: { children: ReactNode }) {
  return <PageAction>{children}</PageAction>;
}

/**
 * A sentence a tab needs before its editor starts.
 *
 * **The tab regions have no `RegionHeader`, and that is the fix for a heading
 * printed three times.** "Where it shows" was the tab's label, then the
 * region's title, then the editor's own `<h3>` — three lines of the same words
 * before a single control. A tab strip already names what is under it, so the
 * region takes its name as an `aria-label` and the visible naming is left to
 * the one place that was always going to say it.
 */
function TabNote({ children }: { children: ReactNode }) {
  return <p className="m-0 text-pretty text-muted-foreground">{children}</p>;
}

/**
 * The way out of the builder.
 *
 * A `<button>` rather than an `<a>`: the list is a state this bundle holds and
 * the builder has no URL of its own, so an `href="#"` a handler cancels would
 * be a link that lies about being one. {@see App} draws the same control on the
 * narrow-screen notice, and there is exactly one of them on screen at a time.
 */
function BackLink({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <Button variant="ghost" size="sm" className="-ms-3" onClick={onClose}>
        <ArrowLeft aria-hidden="true" />
        {__('All Optins', 'wconvert')}
      </Button>
    </div>
  );
}

/**
 * Which [[Display Type]]'s designs the gallery shows.
 *
 * **Not the first question asked.** Users arrive via a [[Goal]] and the type
 * is prefilled by the chosen [[Playbook]]; it is an override and a filter, and
 * never the primary axis of the product (CONTEXT.md, Display Type). So it is
 * read off the Optin, and falls back to whatever the shipped library actually
 * offers rather than to a name spelled here — a free install ships popups, and
 * the day Pro's floating bars and slide-ins land the fallback follows them
 * without this line changing.
 */
function displayTypeOf(config: Config, templates: readonly TemplateEntry[]): string {
  const declared = config.display_type;

  return typeof declared === 'string' ? declared : (templates[0]?.display_type ?? 'popup');
}

/**
 * The Optin's OWN design, wearing the name of the entry it came from.
 *
 * The tree and tokens are the Optin's copy and never the library entry's —
 * improving a Template must not restyle an Optin already running on it
 * (ADR 0010). What the entry supplies is provenance: a name to show, and the
 * id an export would carry. An Optin whose entry this install no longer ships
 * still edits and still renders; it simply has no name but its own id.
 */
function entryFor(
  template: Template,
  templateId: string | undefined,
  templates: readonly TemplateEntry[],
): TemplateEntry {
  const source = templates.find((each) => each.id === templateId);

  return {
    id: templateId ?? 'optin',
    name: source?.name ?? (templateId ?? ''),
    display_type: source?.display_type ?? 'popup',
    tree: template.tree,
    tokens: template.tokens,
  };
}
