import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft, Check, Monitor, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionError, RegionErrorState } from '../shell/Region';
import { Stat, StatRow } from '../shell/Stat';
import { messageOf } from '../shell/loadable';
import { Gallery } from './Gallery';
import { DestinationsEditor } from './DestinationsEditor';
import { Preview } from './Preview';
import { RulesEditor } from './RulesEditor';
import { SettingsPanel } from './SettingsPanel';
import { TOKENS } from './panel';
import { TargetingEditor, type Targeting } from './TargetingEditor';
import { getOptin, getRules, saveOptin, type Rule, type RuleVocabulary } from './api';
import type { Selection, SlotKey } from './slots';
import { listTemplates, type Gallery as TemplateGallery, type TemplateEntry } from '../templates/api';
import { readDashboard, type OptinReport } from '../stats/api';
import { formatCount, formatRate } from '../stats/format';
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
 * FOUR TABS, BECAUSE TRIGGERS, CONDITIONS AND PAGES ARE ONE QUESTION.
 * ============================================================================
 * It shipped as five: *Design · Content · Rules · Where it shows ·
 * Destinations*. But "when does this fire", "who is eligible" and "which pages"
 * are three answers to **one** question — *when and where does this show?* — and
 * a merchant arrives expecting them together. OptinMonster ships the same
 * merge: one *Display Rules* screen holding conditions, actions and a summary,
 * not two tabs a merchant has to know the difference between.
 *
 * So `RulesEditor` and `TargetingEditor` render unchanged, one under the other,
 * inside **Display rules**. They are still two components over two axes — the
 * two client ones and the server one (ADR 0005) — and nothing about the model
 * moved. What moved is a tab.
 *
 * That amends ADR 0039's *"five builder tabs"*, which was a statement about
 * levels rather than a count; the point it was making — that tabs a level below
 * ADR 0036's four sections are not in competition with them — is untouched by
 * there being one fewer.
 *
 * **The name and Save are the page header's, not a tab's.** They act on the
 * whole Optin, so they sit above the tabs where they are reachable from every
 * one of them — which is the same placement rule every other screen follows
 * (ADR 0039). Save at the bottom of the last tab would be a Save a merchant on
 * tab two cannot see.
 *
 * ============================================================================
 * THE PREVIEW IS PINNED BESIDE ALL FOUR, AND IT IS AN INPUT (ADR 0040).
 * ============================================================================
 * It lived inside the settings panel, so a merchant editing a Trigger was
 * changing an Optin with the picture of it on another tab. It is this screen's
 * now: one column, sticky, beside whichever tab is open, stacking underneath
 * below `lg` — and a **Desktop / Mobile** toggle, because most of what these
 * are seen on is a phone and 375px is where a popup's copy either fits or does
 * not.
 *
 * Clicking a slot in it puts the caret in the block that edits that slot;
 * focusing that block outlines the slot. Selection travels as one string and
 * writes nothing, so ADR 0010's boundary is where it was — see `slots.ts`.
 */

export interface OptinBuilderProps {
  readonly id: string;
  readonly onClose: () => void;
}

type Config = Record<string, unknown>;

/** The four surfaces, in the order a merchant meets them. */
type TabId = 'design' | 'content' | 'rules' | 'destinations';

/**
 * Which width the preview is drawn at.
 *
 * Two, not a slider: the question a merchant has is "does my headline fit on a
 * phone", and it is answered by one narrow width rather than by dragging until
 * it breaks. 375px is the iPhone measure every mobile-popup guide is written
 * against.
 */
type Device = 'desktop' | 'mobile';

/**
 * The phone the mobile preview stands in for.
 *
 * 375px is the iPhone measure every mobile-popup guide is written against, and
 * it is a VIEWPORT rather than a container: a popup on a phone is as wide as
 * the phone lets it be, so this is what `--wc-width`'s `min(…, 100%)` resolves
 * against.
 */
const PHONE_WIDTH = '375px';

/**
 * What the design itself asks to be drawn at.
 *
 * Read off the Optin's own token, falling back to the manifest's declared
 * default rather than to a number typed here — the same property `TOKENS` gives
 * the settings panel, which is that a token added to
 * `resources/templates/manifest.json` needs nothing in this bundle edited.
 */
const OWN_WIDTH = TOKENS.find((token) => token.name === 'width')?.fallback ?? '28rem';

export function OptinBuilder({ id, onClose }: OptinBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
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
  /*
   * **Two flags, because they are two different facts.** `saved` says a save
   * has happened and carries the sentence about publishing; `dirty` says there
   * is work that would be lost. A fresh builder is neither — which is exactly
   * the state one flag could not express, and the reason the guard below could
   * not be built on `saved` alone.
   */
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<TabId>('design');
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [stats, setStats] = useState<{ label: string; report: OptinReport } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const back = useRef<HTMLButtonElement>(null);

  const report = useCallback((cause: unknown) => setError(messageOf(cause)), []);

  const template = config?.template as Template | undefined;
  const templateId = typeof config?.template_id === 'string' ? config.template_id : undefined;
  const templates = gallery?.templates;

  /*
   * **Memoised, because identity is what the preview remounts on.** `Preview`
   * rebuilds its whole tree when the template it is handed changes — which is
   * correct on a keystroke and wasteful on a tab switch, and a fresh object per
   * render would make every render look like a keystroke. The design itself is
   * the dependency, so a remount happens exactly when the design changes.
   */
  const entry = useMemo(
    () => (template === undefined || templates === undefined ? null : entryFor(template, templateId, templates)),
    [template, templateId, templates],
  );

  useEffect(() => {
    getOptin(id)
      .then((optin) => {
        setName(optin.name);
        setConfig(optin.config);
        setGoal(optin.goal);
        setPublishedAt(optin.published_at);
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

  /*
   * **This Optin's own numbers, where it is being edited.** A merchant changing
   * a headline is asking whether the change is worth making, and the answer is
   * how the current one is doing — which was two screens away.
   *
   * Only for a PUBLISHED Optin: a draft has been shown to nobody, and a row of
   * dashes above the editor reads as a broken panel rather than as "not yet".
   *
   * **Its failure is swallowed**, exactly as the Goal registry's is in
   * {@see OptinList}. Numbers are a nicety on an editing screen; they must not
   * cost the merchant the Save button, and `error` above is reserved for the
   * failure that would.
   */
  useEffect(() => {
    if (publishedAt === null || goal === null) {
      return;
    }

    readDashboard(null)
      .then((payload) => {
        for (const card of payload.goals) {
          const found = card.optins.find((optin) => optin.id === id);

          if (found !== undefined) {
            setStats({ label: card.headline_label, report: found });

            return;
          }
        }
      })
      .catch(() => undefined);
  }, [id, goal, publishedAt]);

  /*
   * **The browser's own guard, for the ways out this screen does not own.** The
   * back link asks the question itself; a closed tab, a typed URL and the
   * browser's Back button do not pass through it. `beforeunload` is the only
   * hook for those, and it is registered only while there is something to lose
   * — a permanent one makes every reload of a clean builder ask a question with
   * no answer worth giving.
   */
  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // The wording is the browser's and has been for years; what this does is
      // opt in to being asked at all.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = (changes: Config) => {
    setConfig((current) => (current === null ? current : { ...current, ...changes }));
    setSaved(false);
    setDirty(true);
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
        setDirty(false);
      })
      .catch(report)
      .finally(() => setBusy(false));
  };

  /*
   * A slot was clicked in the preview. The block that edits it is on the
   * Content tab, so getting there is part of the act — landing the caret on a
   * tab the merchant is not looking at would be a selection they never see.
   */
  const chooseFromPreview = useCallback((key: SlotKey) => {
    setTab('content');
    setSelection({ key, from: 'preview' });
  }, []);

  const leave = () => (dirty ? setLeaving(true) : onClose());

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
        <BackLink ref={back} onClose={leave} />

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
              setDirty(true);
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

        {stats !== null && (
          <StatRow className="mt-4 max-w-xl">
            <Stat label={stats.label} value={formatCount(stats.report.headline)} />
            <Stat label={__('Impressions', 'wconvert')} value={formatCount(stats.report.impressions)} />
            <Stat
              label={__('Conversion rate', 'wconvert')}
              value={formatRate(stats.report.conversion_rate)}
            />
          </StatRow>
        )}
      </BuilderBand>

      <div className="wconvert-builder">
        <div className="wconvert-builder__tabs">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as TabId);

              /*
               * **The outline says "this is the slot you are editing", so it
               * goes when the merchant stops editing slots.** Left up over the
               * rules tab it is a highlight with nothing on screen explaining
               * it — the affordance reading as decoration, which is the one
               * thing ADR 0037 asks this admin not to do.
               */
              if (value !== 'content') {
                setSelection(null);
              }
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="design">{__('Design', 'wconvert')}</TabsTrigger>
              <TabsTrigger value="content">{__('Content', 'wconvert')}</TabsTrigger>
              <TabsTrigger value="rules">{__('Display rules', 'wconvert')}</TabsTrigger>
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
                  <TabNote>{__('Saves straight away, and keeps your words.', 'wconvert')}</TabNote>
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
                {entry === null ? (
                  <RegionBody className="text-muted-foreground">
                    {__('Pick a design first.', 'wconvert')}
                  </RegionBody>
                ) : (
                  <RegionBody className="wconvert-editor">
                    <SettingsPanel
                      entry={entry}
                      labels={gallery.labels}
                      dev={adminSettings()?.dev === true}
                      selection={selection}
                      onSelect={(key) => setSelection({ key, from: 'panel' })}
                      onChange={(next) => edit({ template: next })}
                      onError={report}
                    />
                  </RegionBody>
                )}
              </Region>
            </TabsContent>

            {/*
              **One tab, three labelled sections.** Triggers, Conditions and
              page targeting are three answers to one question, and the two
              editors underneath are unchanged — the merge is a tab, not a
              model.
            */}
            <TabsContent value="rules">
              <Region label={__('Display rules', 'wconvert')}>
                <RegionBody className="wconvert-editor">
                  <RulesEditor
                    triggers={vocabulary.triggers}
                    conditions={vocabulary.conditions}
                    rules={Array.isArray(config.rules) ? (config.rules as Rule[]) : []}
                    onChange={(rules) => edit({ rules })}
                  />
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

        <PreviewColumn
          entry={entry}
          step={step}
          onStep={setStep}
          device={device}
          onDevice={setDevice}
          selected={selection?.key ?? null}
          onSelect={chooseFromPreview}
        />
      </div>

      {/*
        **Nothing warned before "All Optins" discarded an edit.** Explicit Save
        stays — this admin does not save as you type, deliberately — so the
        price of that decision is a question at the one door that leaves. The
        confirm names the outcome rather than saying "OK", and Cancel is what
        focus lands on.
      */}
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={__('Leave without saving?', 'wconvert')}
        description={__('Your changes to this Optin will be lost.', 'wconvert')}
        confirmLabel={__('Discard changes', 'wconvert')}
        cancelLabel={__('Keep editing', 'wconvert')}
        returnFocusTo={back}
        onConfirm={() => {
          setLeaving(false);
          onClose();
        }}
      />
    </div>
  );
}

/**
 * The preview, and the two things that decide what it is showing.
 *
 * **Beside the tabs rather than inside one.** A merchant tightening a Trigger
 * is still editing the thing on screen, and the preview is the only place they
 * can see what they are editing — so it is pinned to all four tabs and sticks
 * to the scroll, and it stacks underneath below `lg`, where there is no room
 * for a second column and the builder's own floor is 782px (ADR 0038).
 */
function PreviewColumn({
  entry,
  step,
  onStep,
  device,
  onDevice,
  selected,
  onSelect,
}: {
  entry: TemplateEntry | null;
  step: number;
  onStep: (step: number) => void;
  device: Device;
  onDevice: (device: Device) => void;
  selected: SlotKey | null;
  onSelect: (key: SlotKey) => void;
}) {
  const steps = entry?.tree.steps.length ?? 0;
  const shown = Math.min(step, Math.max(steps - 1, 0));
  const measure = device === 'mobile' ? PHONE_WIDTH : (entry?.tokens.width ?? OWN_WIDTH);

  return (
    <aside className="wconvert-builder__preview" aria-label={__('Preview', 'wconvert')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {steps > 1 ? (
          <div className="flex flex-wrap gap-1">
            {entry?.tree.steps.map((_node, index) => (
              <Button
                key={index}
                type="button"
                size="sm"
                variant={index === shown ? 'secondary' : 'ghost'}
                aria-pressed={index === shown}
                onClick={() => onStep(index)}
              >
                {/*
                  Terminal is STRUCTURAL — the success state is the last step
                  rather than a flagged one (ADR 0025) — so the name follows
                  from the position and there is no second spelling to keep in
                  step.
                */}
                {index === 0 ? __('The form', 'wconvert') : __('After they submit', 'wconvert')}
              </Button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            aria-pressed={device === 'desktop'}
            onClick={() => onDevice('desktop')}
          >
            <Monitor aria-hidden="true" />
            <span className="sr-only">{__('Desktop', 'wconvert')}</span>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            aria-pressed={device === 'mobile'}
            onClick={() => onDevice('mobile')}
          >
            <Smartphone aria-hidden="true" />
            <span className="sr-only">{__('Mobile', 'wconvert')}</span>
          </Button>
        </div>
      </div>

      <div
        className="wconvert-builder__stage"
        data-device={device}
        style={{ '--wconvert-stage': measure } as CSSProperties}
      >
        {entry === null ? (
          <p className="m-0 text-muted-foreground">{__('Pick a design to see it here.', 'wconvert')}</p>
        ) : (
          <Preview template={entry} step={shown} selected={selected} onSelect={onSelect} />
        )}
      </div>
    </aside>
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
 *
 * It takes a ref because it is what the unsaved-changes confirm has to put the
 * caret back on — a triggerless dialog restores focus to nothing, which leaves
 * a keyboard merchant on `<body>` ({@see ConfirmDialog}).
 */
function BackLink({ onClose, ref }: { onClose: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <div>
      <Button ref={ref} variant="ghost" size="sm" className="-ms-3" onClick={onClose}>
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
