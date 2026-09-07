import {
  Activity,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Check, Monitor, Redo2, Smartphone, Undo2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BackLink, BuilderSkeleton } from '../shell/BuilderSkeleton';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionError, RegionErrorState } from '../shell/Region';
import { Skeleton } from '../components/ui/skeleton';
import { Stat, StatRow, StatRowSkeleton } from '../shell/Stat';
import { LOADING, failed, messageOf, read, ready, type Loadable } from '../shell/loadable';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { useTemplateTrees } from './TemplatePicker';
import { DestinationsEditor } from './DestinationsEditor';
import { ReadinessDialog } from './ReadinessDialog';
import { hintIn, hintSaid } from './destinations';
import { Preview } from './Preview';
import { DisplayRules, type DisplayRulesValue } from './rules/DisplayRules';
import { DevExport } from './DevExport';
import { StructureView } from './StructureView';
import { Tokens } from './Tokens';
import { canRedo, canUndo, historyOf, redo, remember, undo, type History } from './structure/history';
import { capturesTaken, firstBlockOf, nearestTo, samePath } from './structure/tree';
import { convertingActOf } from './structure/guards';
import type { ConvertingAct } from './structure/catalogue';
import { listGoals, listPlaybooks, type GoalEntry } from '../goals/api';
import { offerableGoals } from '../goals/GoalCard';
import { goalSaid } from '../goals/said';
import { ChangeGoalDialog } from './ChangeGoalDialog';
import { stepName } from './BlockRow';
import { TOKENS, slotsOf, type Path } from './panel';
import {
  getOptin,
  getRules,
  saveOptin,
  type Frequency,
  type Rule,
  type RuleVocabulary,
  type Targeting,
} from './api';
import { keyOfSlot, pathOfKey, type Selection, type SlotKey } from './slots';
import {
  getTemplateTrees,
  listTemplates,
  type TemplateIndex,
  type TemplateIndexEntry,
  type TemplateEntry,
} from '../templates/api';
import { numbersByOptin, readDashboard, type OptinNumbers } from '../stats/api';
import { formatCount, formatRate } from '../stats/format';
import { readDestinations, type DestinationsPayload } from '../destinations/api';
import { adminSettings } from '../settings';
import type { Template } from '@renderer/types';

/**
 * The builder: pick a design, adjust it, and set the rules that decide who
 * sees it and when.
 *
 * ============================================================================
 * FOUR SURFACES OVER ONE `config`, AND NONE OF THEM IS A NEW VOCABULARY.
 * ============================================================================
 * The gallery picks a [[Template]] and the token controls beside it change how
 * it looks; the block tree and its inspector edit the Optin's copy of it; the
 * rules editor edits the two client axes; the targeting picker edits the server
 * one. Everything they write is the same flat, closed
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
 * FOUR TABS, AND THE COUNT HAS MOVED THREE TIMES.
 * ============================================================================
 * **Display rules** is one merge: "when does this fire", "who is eligible" and
 * "which pages" are three answers to one question — *when and where does this
 * show?* — and a merchant arrives expecting them together. `RulesEditor` and
 * `TargetingEditor` render unchanged, one under the other; nothing about the
 * model moved.
 *
 * **Content** is the other. It and *Structure* were two views of one document,
 * which was a fair description and a bad screen: a merchant changing a headline
 * had to pick which copy of the document to open. The argument for keeping them
 * apart — that a merchant fixing a typo must not walk past a move button to
 * reach the sentence — was an argument against a Structure tab you could not
 * type in, and the fix for that is {@see BlockInspector}, not a second tab.
 *
 * The look went the other way. *"How it looks"* — four presets, the theme copy,
 * fifteen tokens, the dev export — was the second half of a tab called Content,
 * which is the one question Content is not about, while the tab called **Design**
 * only picked a template.
 *
 * All of that amends ADR 0039's tab count, which was a statement about levels
 * rather than a number; the point it was making — that tabs a level below
 * ADR 0036's four sections are not in competition with them — is untouched by
 * the number moving under it, which is why the ADR strikes it through rather
 * than rewriting it.
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
 * Clicking a slot in it opens that block in the inspector; selecting a block
 * outlines the slot. The preview still receives a `SlotKey` and still cannot
 * reach a node, so ADR 0010's boundary is where it was — what the EDITOR gained
 * is a `Path` beside it, which is what `panel.ts` has written through all
 * along. See `slots.ts`.
 */

export interface OptinBuilderProps {
  readonly id: string;
  readonly onClose: () => void;
}

type Config = Record<string, unknown>;

/**
 * The four surfaces, in the order a merchant meets them.
 *
 * ============================================================================
 * CONTENT AND STRUCTURE WERE NEVER TWO QUESTIONS. THEY WERE ONE, SPLIT.
 * ============================================================================
 * They shipped separate on the argument that a merchant fixing a typo should
 * not have to walk past a move button to reach the sentence. That argument was
 * true of a Structure tab you could not type in — and the fix for THAT is to
 * let a block be edited where it is selected, which is what the inspector does.
 * With it, the two tabs are one screen drawn twice, and a merchant changing a
 * headline had to pick which copy of it to open.
 *
 * So there is one, and it keeps the word merchants already have: **Content**.
 * The look — presets, the theme copy, the fifteen tokens — moved to **Design**,
 * which is what the word means and which until now only picked a template.
 */
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
 * the Design tab, which is that a token added to
 * `resources/templates/manifest.json` needs nothing in this bundle edited.
 */
const OWN_WIDTH = TOKENS.find((token) => token.name === 'width')?.fallback ?? '28rem';

/**
 * The `<input>` types a browser keeps its own undo stack for.
 *
 * **Listed rather than "is it an input".** A checkbox, a radio and a colour
 * swatch are `<input>`s with nothing to undo, and a ⌘Z pressed on one of those
 * should step the DESIGN — which is the whole point of the shortcut. Only a box
 * you type characters into has a stack of its own to defer to.
 */
const TYPES_INTO = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

/** Is this where the merchant is typing, and does it already own ⌘Z? */
function typesInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && TYPES_INTO.has(target.type))
  );
}

/**
 * The [[Slot Role]] key at a path, or null where the block has none.
 *
 * A layout has no slot and a role-less leaf has no key, and both are addressable
 * — which is exactly why the selection carries a `Path` beside the key
 * (`slots.ts`). The preview simply cannot outline what it cannot name.
 */
function keyAt(template: Template | undefined, path: Path): SlotKey | null {
  if (template === undefined) {
    return null;
  }

  const slot = slotsOf(template.tree).find((each) => samePath(each.path, path));

  return slot === undefined ? null : keyOfSlot(slot);
}

export function OptinBuilder({ id, onClose }: OptinBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  /*
   * **Why this Optin is [[Suspended]], or null.** `published_at` cannot answer
   * "is the site serving this": a suspended Optin IS published and is on no
   * page at all, so the readiness panel reading the column alone would print
   * "Published" over an Optin the site is holding back. `show()` resolves it
   * off the same published set the Optin list reads.
   */
  const [suspended, setSuspended] = useState<string | null>(null);
  const [deletedAt, setDeletedAt] = useState<string | null>(null);
  const [vocabulary, setVocabulary] = useState<RuleVocabulary | null>(null);
  const [gallery, setGallery] = useState<TemplateIndex | null>(null);
  /*
   * **Choosing a design is its own surface now** (ADR 0039, ADR 0043). The
   * Design tab held two concerns — *choose a design* and *adjust the look* —
   * which was invisible at three cards and swamps the tokens the tab is named
   * for at forty.
   */
  const [browsing, setBrowsing] = useState(false);
  const browse = useRef<HTMLButtonElement>(null);
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
  /*
   * **Which colour picker is open, held OUTSIDE the tab that owns it.** The
   * panel is inside an `<Activity mode="hidden">` and a Radix popover portals
   * to `document.body`, so a picker opened on Design outlived the switch to
   * Content — see the `onValueChange` below for why closing it from in there
   * does not work.
   */
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [selection, setSelection] = useState<Selection | null>(null);
  /**
   * This Optin's numbers, in the three states a region that fetches has.
   *
   * ==========================================================================
   * `null` WAS BOTH "STILL LOADING" AND "NOT IN THE PAYLOAD", AND THAT IS THE
   * DISTINCTION A RESERVED ROW NEEDS.
   * ==========================================================================
   * It was `OptinNumbers | null` and rendered nothing until the read landed, so
   * the strip popped in and pushed the tab strip down — which `emphasis` makes
   * a taller jump. Reserving the row needs a state that means *loading*, and a
   * published Optin the dashboard has no row for has to stop reserving it.
   *
   * {@see Loadable} rather than a second boolean, which is the same reason
   * `goalEntry` above uses one: three exclusive states are not two booleans.
   * **It opens `LOADING`**, so the reservation is there on the first paint
   * rather than one effect later — an effect runs after the browser has already
   * drawn a row-less builder, which is the shift this exists to remove.
   */
  const [stats, setStats] = useState<Loadable<OptinNumbers | null>>(LOADING);
  /*
   * ========================================================================
   * UNDO MOVES THE WORKING DRAFT. SAVE IS WHAT SENDS IT.
   * ========================================================================
   * `config` is the draft and `published_config` is what the site serves, so
   * undoing is not undoing a publish — which is why undoing ACROSS a save is
   * allowed and re-marks the screen dirty. A history that refused to cross one
   * would read as "your last save is permanent", which is what a separate draft
   * column exists to make untrue.
   *
   * It lives here rather than in the Structure tab because a design changes from
   * four places: a keystroke in Content, a block moved in Structure, a Template
   * repicked on Design, and the server's normalised answer to a save. All four
   * arrive below as one new `template` identity and all four are one entry —
   * which is what makes "a template switch is one undo entry, not one per node"
   * true by construction rather than by counting.
   */
  const [past, setPast] = useState<History<Template> | null>(null);
  /*
   * **Every [[Goal]] this install has**, read off the same route the creation
   * flow reads. **No Goal id is spelled in this bundle** — `goals/api.ts` says
   * why, and `GoalParityTest` fails the day one appears, comments included.
   *
   * ==========================================================================
   * THE WHOLE LIST NOW, BECAUSE THIS SCREEN CAN CHANGE THE GOAL (ADR 0059).
   * ==========================================================================
   * It held the ONE entry this Optin's `goal` pointed at, found by filtering
   * the response and throwing the rest away — which was right while a Goal was
   * chosen in a wizard that could not be re-entered. {@see ChangeGoalDialog}
   * needs the set, and a second request for a list this component already
   * downloaded would be a second answer to *"what Goals does this install
   * have"*.
   *
   * **Fetched once, like the rule vocabulary and the gallery**, and no longer
   * keyed on `goal`: the list is the INSTALL's and does not change when this
   * Optin's Goal does. Keyed on it, changing the Goal refetched the list to
   * learn a fact the list already held.
   */
  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);
  /** Whether the merchant has the Goal picker open. */
  const [changingGoal, setChangingGoal] = useState(false);
  const changeGoal = useRef<HTMLButtonElement>(null);
  /**
   * What the other arms of this Optin's A/B test convert on, or null.
   *
   * The one thing on this screen the builder cannot read off the document in
   * front of it: it lives in the siblings' own `config`s, so the server
   * resolves it beside `suspended` ({@see OptinDraft.sibling_act}). It is what
   * lets the picker mark a design that would make the two arms incomparable
   * BEFORE the click rather than after it (ADR 0042 rule 3, ADR 0059).
   */
  const [siblingAct, setSiblingAct] = useState<ConvertingAct | null>(null);
  /*
   * **What the [[Playbook]] this Optin started from is called.** Provenance,
   * exactly as `template_id` is: prefill snapshots a Playbook's values and the
   * two never speak again, so there is nothing to edit and everything to show —
   * and it was shown nowhere at all after the creation wizard closed.
   *
   * Looked up by id in the Playbooks for this Optin's Goal, which is the read
   * that already exists. Null covers all three of "no Playbook", "not answered
   * yet" and "an entry this install no longer ships", and the panel simply
   * omits the row: a Playbook that has been unregistered still leaves a
   * perfectly good Optin behind, and its id is not a word.
   */
  const [playbook, setPlaybook] = useState<Loadable<string | null>>(LOADING);
  /*
   * **The site's [[Destination]]s, read once for the two surfaces that need
   * them.** `DestinationsEditor` owned this read; the readiness panel needs the
   * same payload to say where the Leads go and whether anything is failing, and
   * a second fetch would be two round trips and two failure paths for one list
   * that is site-level configuration rather than a function of this Optin.
   */
  const [destinations, setDestinations] = useState<Loadable<DestinationsPayload>>(LOADING);
  /*
   * **A row the screen has asked the tree to put focus on.** The readiness
   * panel is the only thing that asks: following *"this block will lose its
   * words"* to the block it names is a selection AND focus on that row, and
   * the problems now live above the tabs rather than inside the tree. A fresh
   * object per request, because identity is the signal — asking twice for the
   * same row has to be two requests.
   */
  const [focusRow, setFocusRow] = useState<{ path: Path } | null>(null);
  /** Its mirror one tab over: which rules section the screen has asked to open. */
  const [revealSection, setRevealSection] = useState<{ id: string; focus?: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  /** See the history effect below: which control the pending change came from. */
  const coalescing = useRef<string | null>(null);

  const report = useCallback((cause: unknown) => setError(messageOf(cause)), []);

  /**
   * This Optin's [[Goal]] as the registry resolved it, in the three states a
   * lookup has.
   *
   * `ready(null)` is *"this build cannot name that Goal"* and `loading` is
   * *"nobody has answered yet"* — a distinction the panels below depend on,
   * because a raw id flashing into a label teaches a merchant that the
   * `<code>` means *wait* rather than what it says.
   *
   * **A failed list reads as `ready(null)`**, which is the same fix
   * {@see OptinList} made for the same read: a registry that answered nothing
   * is one this build genuinely cannot name a Goal from, and its outage must
   * cost a row rather than cost the merchant their Save button.
   */
  const goalEntry: Loadable<GoalEntry | null> = useMemo(() => {
    if (goals.status === 'loading' || goal === null) {
      return LOADING;
    }

    return ready(goals.status === 'ready' ? (goals.data.find((each) => each.id === goal) ?? null) : null);
  }, [goals, goal]);

  const entryOfGoal = goalEntry.status === 'ready' ? goalEntry.data : null;
  /** The numbers themselves, once there are some — null while loading and where there are none. */
  const numbers = stats.status === 'ready' ? stats.data : null;
  /** The [[Destination]] ids this Optin pushes to, as `config` holds them. */
  const bound = Array.isArray(config?.destinations) ? (config.destinations as string[]) : [];

  /*
   * **The four axes, read out of `config` ONCE.** Both the rules editor and the
   * readiness panel above it need them, and *"an absent `priority` is 0"* is a
   * decision rather than a formality — `arbitrate()` reads `priority ?? 0` and
   * the save route drops a stored 0 for exactly that reason. Spelling that
   * twice is two places for one reading to stop agreeing.
   */
  const displayRules = {
    rules: Array.isArray(config?.rules) ? (config.rules as Rule[]) : [],
    targeting: (config?.targeting ?? {}) as Targeting,
    frequency: (config?.frequency ?? {}) as Frequency,
    // **Two flat keys, read into one value.** They are stored beside
    // `frequency` and `priority` rather than nested, which is what
    // `PublishedProjection` ships and what `src/Optin/Schedule.php`
    // normalises; the object is this screen's shape for them, because one
    // control writing both is one patch and one undo step.
    schedule: {
      ...(typeof config?.starts_at === 'string' ? { starts_at: config.starts_at } : {}),
      ...(typeof config?.ends_at === 'string' ? { ends_at: config.ends_at } : {}),
    },
    priority: typeof config?.priority === 'number' ? config.priority : 0,
  };

  const template = config?.template as Template | undefined;
  const templateId = typeof config?.template_id === 'string' ? config.template_id : undefined;
  const templates = gallery?.templates;

  /**
   * ==========================================================================
   * WHICH ACT THIS OPTIN CONVERTS ON — READ OFF THE DESIGN, NOT OFF THE GOAL.
   * ==========================================================================
   * It came from `converting_act` on the registry entry, and that was the
   * duplicate ADR 0059 deleted: `TemplateLibrary::refuse()` already rejects a
   * design offering two acts or none, so a design in hand offers exactly one
   * and the Goal had nothing to add. `convertingActOf` is the same walk
   * `ConvertingAct::offeredIn()` makes on the server, over the same tree the
   * renderer draws.
   *
   * **It is no longer nullable, and that deletes a real defect.** The registry
   * answered a round trip after the design did, so every consumer took
   * `act ?? 'submit'` and the structure editor spent its first renders
   * offering a click-metered Optin a submit button's menu. There is nothing
   * left to wait for.
   *
   * **`submit` where a design offers nothing**, which is a design with no
   * button on it: the editor's answer there is *"add the button that submits
   * the form first"*, which is the actionable half of an unanswerable
   * question. The Optin is separately marked as reporting zero forever
   * ({@see problemsIn}), which is the sentence that matters.
   */
  const act: ConvertingAct =
    template === undefined ? 'submit' : (convertingActOf(template.tree)[0] ?? 'submit');
  /** What this Optin's design asks a visitor for — the other half of {@see Fit}. */
  const captures = template === undefined ? [] : capturesTaken(template.tree);

  /** Whether this Optin competes for the screen — only an overlay does. */
  const overlay = config === null || displayTypeOf(config, templates) !== 'inline';

  /*
   * **The designs behind the cards on screen, and the one that is in use.**
   * `GET /templates` is an index now — a card is a name, a Display Type, a
   * tier and five derived facets, and no tree (ADR 0043) — so the trees arrive
   * per card, batched, as the grid brings them near the viewport.
   *
   * `want(templateId)` outside the picker is what keeps the Design tab's token
   * controls able to say "what have I actually changed?": that answer is a
   * comparison against the LIBRARY entry's tokens, and the library entry no
   * longer travels with the index.
   */
  const { trees, want } = useTemplateTrees(getTemplateTrees);

  useEffect(() => {
    if (templateId !== undefined) {
      want(templateId);
    }
  }, [templateId, want]);

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
        setSuspended(optin.suspended);
        setDeletedAt(optin.deleted_at);
        setSiblingAct(optin.sibling_act);
      })
      .catch((cause: unknown) => setFatal(messageOf(cause)));
  }, [id]);

  /*
   * The rule vocabulary, the gallery and the [[Goal]] registry are the
   * INSTALL's rather than this Optin's, so they are fetched once and survive
   * every edit below.
   *
   * **The Goals moved into this effect**, from one keyed on `goal` that
   * filtered the response down to a single entry and threw the rest away. Two
   * things changed and both are ADR 0059's: this screen can change the Goal
   * now, so it needs the set — and keying the read on `goal` meant changing
   * one refetched the list to learn a fact the list already held.
   *
   * The Goals' failure is swallowed, like the numbers below: without them the
   * band cannot name the Goal and the picker cannot offer another, and nothing
   * else on this screen is affected. An editor that refused to open because a
   * lookup failed would be a worse answer than a band one line short.
   */
  useEffect(() => {
    getRules()
      .then(setVocabulary)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
    listTemplates()
      .then(setGallery)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
    listGoals()
      .then((entries) => setGoals(ready(entries)))
      /*
       * **Failure RESOLVES rather than staying in flight**, which is the same
       * fix {@see OptinList} made for the same read: a row held forever is a
       * cell that never fills, while a registry that answered nothing is one
       * this build genuinely cannot name a Goal from — which is exactly what
       * the `<code>` fallback says.
       */
      .catch((cause: unknown) => setGoals(failed(cause)));
  }, []);

  /*
   * **The name of the [[Playbook]] this Optin was prefilled from.**
   *
   * Filtered on the Goal, because that is the only shape `GET /playbooks` has —
   * and it is the right one: a Playbook serves exactly one Goal, so an Optin's
   * own Goal is where its Playbook is. An Optin whose Goal was later corrected
   * therefore stops naming its Playbook, which is honest rather than a gap:
   * the entry the id points at is one written for a different outcome.
   *
   * Swallowed like the read above it, and skipped entirely where there is no
   * `playbook_id` — most Optins started from scratch, and a request per builder
   * load to learn that is a request for nothing.
   */
  useEffect(() => {
    const from = config?.playbook_id;

    if (typeof from !== 'string' || from === '') {
      /*
       * Most Optins started from scratch. Resolving to "no name" rather than
       * leaving the read in flight is what lets the panel tell *"there is no
       * Playbook"* from *"we have not looked yet"* — and the row is drawn off
       * the stored id, so neither draws anything here.
       */
      setPlaybook(ready(null));

      return;
    }

    if (goal === null) {
      return;
    }

    listPlaybooks(goal)
      .then((entries) => setPlaybook(ready(entries.find((each) => each.id === from)?.name ?? null)))
      .catch(() => setPlaybook(ready(null)));
    /*
     * Keyed on the id rather than on `config`, which changes on every
     * keystroke. `playbook_id` is provenance and cannot change while this
     * screen is open — nothing in the builder writes it — so this runs once.
     */
  }, [goal, config?.playbook_id]);

  /*
   * The site's [[Destination]]s: site-level configuration rather than a
   * function of this Optin, so it is read once and survives every edit.
   *
   * **Its failure is the Destinations tab's, not the page's.** It used to go to
   * `report` and land in the banner above the tab strip — a page-scoped
   * treatment for a failure that costs exactly one tab, and one that left the
   * tab itself still drawing "Loading…" underneath it, because `null` meant
   * both in-flight and failed. `Loadable` carries the third state and
   * {@see DestinationsEditor} draws it where the merchant is looking, which is
   * `Region`'s own rule about an error naming a door on this screen.
   */
  useEffect(() => {
    readDestinations()
      .then((payload) => setDestinations(ready(payload)))
      .catch((cause: unknown) => setDestinations(failed(cause)));
  }, []);

  /*
   * Every change to the design, from wherever it came, as one history entry.
   *
   * Watching the VALUE rather than instrumenting the four call sites is what
   * makes that total: a fifth way to change a design would be remembered
   * without this line being edited, and `remember` ignores an edit that changed
   * nothing by identity, so a redraw is not an entry.
   */
  useEffect(() => {
    if (template === undefined) {
      return;
    }

    /*
     * **Which control this change came from, read once and cleared.** A
     * keystroke sets it just before writing; every other path leaves it null,
     * which is what makes a move, a save or a template switch break a burst of
     * typing rather than extend it.
     *
     * A ref rather than state, because it is an ANNOTATION on the value this
     * effect is already watching — a second piece of state would be a second
     * render and a second chance for the two to disagree about which change
     * they describe.
     */
    const key = coalescing.current;

    coalescing.current = null;

    const into = key === null ? null : { key, at: Date.now() };

    setPast((current) => (current === null ? historyOf(template) : remember(current, template, into)));
  }, [template]);

  /*
   * **Something is always selected, so the editor is never a list with an
   * instruction under it.**
   *
   * A merchant opening the tab is already editing the first block rather than
   * reading a sentence about what to click — and the inspector, which is never
   * empty by construction, has something to show from the first render.
   *
   * Only when there is nothing selected: this is arrival and a design switch,
   * not a correction applied on every keystroke. The re-resolution below is
   * what keeps an existing selection pointing at something.
   */
  useEffect(() => {
    if (template === undefined) {
      return;
    }

    setSelection((current) => {
      if (current !== null) {
        return current;
      }

      const path = firstBlockOf(template.tree);

      if (path === null) {
        return null;
      }

      const slot = slotsOf(template.tree).find((each) => samePath(each.path, path));

      return { path, key: slot === undefined ? null : keyOfSlot(slot), from: 'tree' };
    });
  }, [template]);

  /*
   * **The selection re-resolved against whatever the tree now is.**
   *
   * A key survived every kind of change for free, because it named a slot
   * rather than a place. A path does not: a save replaces the tree with the
   * server's normalised copy, and an undo can restore a design the selected
   * block was never in. Neither may leave the inspector pointing at nothing.
   *
   * {@see nearestTo} walks outward rather than clearing — the block, else
   * whatever was holding it, else the design's first block — because a blank
   * inspector is a state with nothing on screen to explain it.
   *
   * Identity is returned where nothing moved, so this costs a keystroke a walk
   * of the tree and no render.
   */
  useEffect(() => {
    if (template === undefined) {
      return;
    }

    setSelection((current) => {
      if (current === null) {
        return current;
      }

      const path = nearestTo(template.tree, current.path);

      if (path === null) {
        return null;
      }

      const slot = slotsOf(template.tree).find((each) => samePath(each.path, path));
      const key = slot === undefined ? null : keyOfSlot(slot);

      return samePath(path, current.path) && key === current.key ? current : { ...current, path, key };
    });
  }, [template]);

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
   *
   * The walk from cards to one row is {@see numbersByOptin}, which the Optin
   * list also reads — this screen had its own copy of it, beside its own copy
   * of the swallowed `catch`, which is how one read came to be spelled twice.
   * That comment also records why the whole dashboard is fetched to find one
   * row, and the answer is ADR 0034.
   */
  useEffect(() => {
    if (publishedAt === null || goal === null) {
      return;
    }

    readDashboard(null)
      .then((payload) => setStats(ready(numbersByOptin(payload)[id] ?? null)))
      // Swallowed, but not left LOADING: a failed read that kept the row
      // reserved would be a skeleton pulsing over a working builder forever.
      .catch(() => setStats(ready(null)));
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

  /*
   * Memoised so the keyboard shortcut below can list what it depends on and
   * bind once per history step rather than once per keystroke. Every setter it
   * reaches is stable and `coalescing` is a ref, so it has nothing to capture.
   */
  const edit = useCallback((changes: Config, coalesce?: string) => {
    coalescing.current = coalesce ?? null;
    setConfig((current) => (current === null ? current : { ...current, ...changes }));
    setSaved(false);
    setDirty(true);
  }, []);

  /**
   * Send the draft, and — only where the merchant just changed one — the
   * [[Goal]] beside it.
   *
   * **`nextGoal` is undefined on every ordinary Save**, and that is a rule
   * rather than an optimisation: `saveDraft()` writes what it is handed, so a
   * `goal` on every PATCH would make *"correcting a Goal"* indistinguishable
   * from *"saving"*. It also never travels without the config, because the
   * pair is what the server checks — a Goal read from deliveries needs a
   * design that captures something, and the answer has to be about the design
   * on screen (ADR 0059).
   */
  const save = (next: Config = config ?? {}, nextGoal?: string) => {
    setBusy(true);
    setError(null);

    return saveOptin(id, name, next, nextGoal)
      .then((optin) => {
        // The server's copy wins: it normalises against both vocabularies on
        // the way in, and a screen that kept its own would show a rule or a
        // node that was dropped at the boundary.
        setConfig(optin.config);
        // And its copy of the Goal wins for the same reason. It is the column
        // the save actually wrote, so a refused correction leaves the band
        // saying what the Optin still holds rather than what was asked for.
        setGoal(optin.goal);
        setSaved(true);
        setDirty(false);
      })
      .catch(report)
      .finally(() => setBusy(false));
  };

  /*
   * A slot was clicked in the preview. **Where that lands depends on which
   * question the merchant is already asking.**
   *
   * From anywhere else, the block that edits it is on the Content tab, so
   * getting there is part of the act — landing the caret on a tab the merchant
   * is not looking at would be a selection they never see. From STRUCTURE it is
   * not: they are asking *where is this in the list*, and yanking them to
   * Content answers a question they did not ask and loses the row they were on.
   *
   * The current tab is read through `setTab`'s updater rather than captured in
   * the closure, so this stays stable across renders — which matters because
   * {@see Preview} re-binds every listener in the shadow tree when it changes.
   */
  const chooseFromPreview = useCallback((key: SlotKey) => {
    // One editing surface now, so there is no longer a tab this must NOT yank
    // a merchant away from: clicking a block asks to edit that block.
    setTab('content');
    /*
     * **The key arrives; the path is looked up.** The preview names slots and
     * only slots (ADR 0040), so it cannot hand over an address — which is
     * exactly the property that lets it stay unable to write. The tree is read
     * through the setter so this callback stays stable across renders:
     * {@see Preview} re-binds every listener in the shadow tree when it changes.
     */
    setConfig((current) => {
      const tree = (current?.template as Template | undefined)?.tree;

      setSelection(
        tree === undefined ? null : { path: pathOfKey(tree, key) ?? [], key, from: 'preview' },
      );

      return current;
    });
  }, []);

  /*
   * A row was clicked in the block tree. It outlines the block in the preview
   * and moves no caret: the merchant already has focus, on the row.
   */
  const chooseFromTree = useCallback((key: SlotKey | null, path: Path) => {
    setSelection({ path, key, from: 'tree' });

    /*
     * **Selecting a block puts the preview on the step it lives in.** A block
     * on step 2 selected while the preview showed step 1 outlined nothing a
     * merchant could see, which reads as a broken highlight rather than as a
     * step they have not switched to.
     */
    if (typeof path[0] === 'number') {
      setStep(path[0]);
    }
  }, []);

  /*
   * Stepping the history moves the pointer FIRST and then writes the design it
   * points at, so the effect above sees a `template` the history already holds
   * and remembers nothing. Writing first would push the restored value on as a
   * new entry, and undo would immediately have something to redo that was not
   * an edit.
   */
  const stepping = useCallback(
    (move: (held: History<Template>) => History<Template>) => () => {
      if (past === null) {
        return;
      }

      const next = move(past);

      if (next === past) {
        return;
      }

      setPast(next);
      edit({ template: next.present });
    },
    [past, edit],
  );

  /*
   * ========================================================================
   * ⌘Z AND ⇧⌘Z, WHICH `history.ts` WAS WRITTEN FOR AND NEVER WIRED TO.
   * ========================================================================
   * {@link undo} returns its input by identity on a no-op, and its own comment
   * says that is *"what lets a caller wire a keyboard shortcut without asking
   * `canUndo` first"*. There was no such caller. In an editor this is expected
   * rather than a nicety — a merchant who has just deleted a block reaches for
   * ⌘Z before they look for a button.
   *
   * **On `window`, not on the builder's own element.** A keydown is delivered
   * to whatever holds focus, and after a click on empty page that is `<body>`
   * — which is an ANCESTOR of this screen, so a listener on the screen would
   * never see it. The shortcut has to work from wherever the merchant's focus
   * happens to be, which is what `window` means here.
   *
   * **It stands aside for anything with an undo stack of its own.** The name
   * field and every text box in the inspector have one, and a ⌘Z that stepped
   * the design instead of the sentence being typed would be a shortcut that
   * takes back the wrong thing. A checkbox, a radio and a colour swatch have no
   * such stack, so those keep the design's.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') {
        return;
      }

      if (typesInto(event.target)) {
        return;
      }

      /*
       * Prevented whether or not there is a step to take. On a fresh screen
       * ⌘Z does nothing quietly, which is what it does everywhere else — and
       * what it must NOT do is fall through to the browser's own undo on a
       * page whose editing surface this is.
       */
      event.preventDefault();
      stepping(event.shiftKey ? redo : undo)();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepping]);

  /**
   * Open the block a problem is about, from wherever the merchant read about
   * it.
   *
   * **The tab switch is the part only this level can do.** The verdict is on
   * the Design tab as well now, and a sentence pointing at a block is useless
   * if following it lands a selection on a list nobody is looking at.
   */
  const goTo = (path: Path) => {
    setTab('content');
    chooseFromTree(keyAt(template, path), path);
    setFocusRow({ path });
  };

  /*
   * ==========================================================================
   * THE OTHER DESTINATION, AND IT IS NOT A BLOCK.
   * ==========================================================================
   * A `countdown` counts to the Optin's `ends_at` and carries no deadline of
   * its own (ADR 0052), so the fix for *"the clock will be empty"* is a field
   * on the Rules tab. Three steps rather than one, because a route that lands
   * on the right tab with the section shut has stopped one click short
   * (ADR 0054 rule 4) — and the section-open half is the mechanism the rules
   * panel grew for its own reasons.
   *
   * A fresh object every time, because identity is the signal: asking twice for
   * the same section has to be two requests, exactly as {@link setFocusRow}
   * does one tab over.
   */
  const goToSchedule = () => {
    setTab('rules');
    setRevealSection({ id: 'how-often', focus: 'wconvert-ends-at' });
  };

  /** Undo and redo as the toolbar takes them, on either tab that draws it. */
  const history = {
    canUndo: past !== null && canUndo(past),
    canRedo: past !== null && canRedo(past),
    undo: stepping(undo),
    redo: stepping(redo),
  };

  const leave = () => (dirty ? setLeaving(true) : onClose());

  /*
   * ==========================================================================
   * THE BROWSER'S BACK BUTTON LEAVES THE BUILDER, THROUGH THE SAME GUARD.
   * ==========================================================================
   * It did nothing. {@see App} listens for `hashchange` and sets `section`, but
   * its `editing !== null` branch returns before `section` is read — so Back
   * changed the URL, left the builder open, and asked nothing about the unsaved
   * work in it, because as far as this screen was concerned no navigation had
   * happened.
   *
   * **The listener is HERE and not in `App`, because the guard is here.** `App`
   * holds only `onClose`, which closes unconditionally; `leave` is what knows
   * whether there is anything to lose. Routing Back through `App` would be the
   * one exit out of four that skips the confirm.
   *
   * **`nav.ts` is untouched and the builder still has no URL of its own** —
   * that is deliberate (#62), and it is what {@see OptinList} relies on when it
   * opens a row with a `<button>` rather than an `<a href="#">` that lies. Back
   * is a way OUT of the builder, not a route into it.
   *
   * *Known and accepted:* if the merchant cancels the confirm, the hash is
   * already pointing at the section they asked for while the builder is still
   * open. Putting it back means writing history for a screen that has no
   * history entry of its own, which is the route-shape change this deliberately
   * is not. Pressing Back again simply asks again.
   */
  useEffect(() => {
    const follow = () => leave();

    window.addEventListener('hashchange', follow);

    return () => window.removeEventListener('hashchange', follow);
  });

  if (fatal !== null) {
    return (
      <div className="flex flex-col gap-5">
        <PageAction>
          <BackLink onClose={onClose} />
        </PageAction>
        <Region label={__('Optin builder', 'wconvert')}>
          <RegionErrorState
            message={fatal}
            hint={__('Reload the page to try again.', 'wconvert')}
          />
        </Region>
      </div>
    );
  }

  /*
   * **The same skeleton the lazy boundary draws while the chunk is in flight**
   * ({@see BuilderSkeleton}). Opening the builder is two waits end to end — the
   * chunk, then `getOptin` — and a merchant should see one placeholder across
   * both rather than one placeholder replaced by a different one at the moment
   * the code arrives.
   */
  if (config === null || vocabulary === null || gallery === null) {
    return <BuilderSkeleton onClose={onClose} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/*
        **The same band every other screen has, and it IS the frame's.** The
        builder has no `section`, so the frame draws it no title — but it does
        have a title of its own and an action that acts on the whole Optin, and
        those belong on the same surface as every other screen's. Drawing a
        lookalike inside `<main>` got the surface right and the width wrong:
        `main` is a centred measure, so the rule under the band stopped a
        hundred pixels short of the screen. `Shell`'s `bareHeader` renders the
        real band and {@see PageAction} portals this into it — and the band and
        `main` now read one `--wconvert-measure`, which is what stops that
        mismatch returning when this screen asks for the wider one.

        All three arms of this screen portal into the same one — and so does
        {@see BuilderSkeleton} on the far side of the lazy boundary — so a slow
        load never draws a header that then moves.
      */}
      <PageAction>
        <BackLink ref={back} onClose={leave} />

        {/*
          **A page needs a heading, and an `<input>` is not one.** The name is
          editable in place, which is right for the title of a thing you are
          building — but it left the document with no `h1` at all, on the one
          screen a merchant spends real time in. The visible title stays the
          field; the heading says the same words to anything reading structure.
        */}
        <h1 className="sr-only">{name === '' ? __('Untitled Optin', 'wconvert') : name}</h1>

        {/*
          ======================================================================
          THE TITLE LEADS, THE ACTIONS TRAIL. THEY ARE NOT "BESIDE" ANYTHING.
          ======================================================================
          Two attempts put `Save changes` next to the name — `flex-1` on the
          input, then a `max-w-sm` cap, then sizing the input to its content —
          on ADR 0039's reading that *"the eye pairs them"*. All three were
          wrong for this band, and the reason is what the ADR's own examples
          have in common and this screen does not: on the reading screens the
          title is a fixed LABEL and the action is one button, so "beside" is a
          stable arrangement. Here the title is an editable field whose width is
          the merchant's, and an action anchored to a moving edge lands
          somewhere different for every Optin they open.

          So the band is a title and a trailing action group, which is where
          both the editors worth measuring against put them and where a
          merchant's hand already is. `justify-between` is the whole of it: the
          name takes what it needs at the leading edge, the controls sit at the
          trailing one, and neither depends on the other's length.
        */}
        <div className="wconvert-page-actions mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <label htmlFor="wconvert-optin-name" className="sr-only">
            {__('Name', 'wconvert')}
          </label>
        {/*
          The name IS the title, so it is edited where the title stands rather
          than in a field labelled "Name" above the design. Borderless until it
          is focused, which is what says "this text is editable" without
          drawing a form on a screen that is not one.

          **It is sized by its CONTENT, and that is what finally puts Save
          beside it.**

          `flex-1` put the button at the far right of a 1440px row, a thousand
          pixels from the words it acts on. Capping it at `max-w-sm` was no
          better and was wrong in a way worth naming, because it LOOKED fixed:
          the button then sat beside a 384px box rather than beside the title,
          so "Welcome discount" left ~180px of nothing between the words and the
          control. A merchant does not see an input's edge — they see a button
          floating in the middle of a band.

          `size` is a character count, which is the one width an `<input>` has
          always been able to derive from what is in it: no measurement, no ref,
          no layout effect. The floor keeps an empty field big enough to aim at
          and the ceiling keeps a long name from pushing Save off the band;
          between them the button tracks the title.
        */}
          <input
            id="wconvert-optin-name"
            type="text"
            value={name}
            size={Math.min(Math.max(name.length + 1, 16), 40)}
            placeholder={__('Untitled Optin', 'wconvert')}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
              setDirty(true);
            }}
            className="wconvert-optin-name min-w-0 max-w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-title font-semibold leading-tight tracking-tight text-foreground hover:border-border focus:border-ring focus:bg-background focus:outline-none"
          />

          {/*
            The trailing group: what has been saved, what can be taken back, and
            the commit. All three act on the whole draft, which is why they are
            one group rather than three things spaced along a band.
          */}
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {/*
              **"Saved" says where publishing happens.** Editing is not
              publishing — `config` is the draft and `published_config` is what
              the site serves — and a merchant who saved and saw nothing go live
              needs that sentence here rather than in a support reply.
            */}
            {saved && (
              <span className="flex items-center gap-1.5 text-note text-muted-foreground">
                <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                {__('Saved. Publish it from the list when it is ready.', 'wconvert')}
              </span>
            )}

            {/*
              **History sits with the thing it acts on.** Undo and Redo move the
              whole draft, which is exactly the scope `Save changes` has — so
              they belong in this band rather than in a region toolbar, where
              they cost a full-width bordered strip at the top of two tabs for
              two controls a merchant reaches for occasionally. Icon-only and
              quiet, immediately before the commit, which is the order every
              editor uses.
            */}
            {/*
              **What this Optin is FOR, one press away.** [[Goal]] and
              [[Playbook]] are chosen in a creation wizard that cannot be
              re-entered and Publish lives on the Optin list, so the screen a
              merchant spends real time in could say none of it. It reports on
              the whole Optin and acts on nothing, which is the same scope
              `Save changes` and the history controls have — ADR 0039's test —
              so it sits with them rather than inside any one tab.

              It shipped twice as a permanent panel above the tab strip, and
              both times the room was the objection rather than the content.
            */}
            <ReadinessDialog
              optin={{ published_at: publishedAt, deleted_at: deletedAt, suspended }}
              goal={goalEntry}
              goalId={goal ?? ''}
              playbook={playbook}
              playbookId={typeof config.playbook_id === 'string' ? config.playbook_id : ''}
              rules={displayRules}
              vocabulary={vocabulary}
              overlay={overlay}
              bound={bound}
              template={template}
              growsAList={entryOfGoal?.grows_a_list === true}
              destinations={read(destinations)?.destinations ?? null}
              onGoTo={goTo}
              onGoToSchedule={goToSchedule}
            />

            <HistoryControls history={history} />

            <Button disabled={busy} onClick={() => void save()}>
              {__('Save changes', 'wconvert')}
            </Button>
          </div>
        </div>

        {/*
          ==================================================================
          THE GOAL, ON SCREEN — AND A WAY TO CORRECT IT (ADR 0059).
          ==================================================================
          **It was invisible exactly where it hurt.** A [[Goal]] is chosen in a
          three-step wizard that cannot be re-entered, and the builder's only
          mention of it was one click deep behind a button labelled *Summary*.
          So a merchant met *"your goal counts click-throughs"* on five of
          seven greyed-out design cards without ever being told which goal that
          was, and the server's own refusal had the words *"or change the
          Goal"* taken out of it because no such control existed.

          **A line rather than the panel this was twice before.** It shipped as
          a permanent card above the tab strip (~190px) and as a disclosure
          (46px), and both were rejected for the room they cost on an editor
          whose floor is 782px (ADR 0038). One muted line under the name is
          what a subject costs — and unlike the Summary behind it, it answers a
          question the merchant has on arrival every time (ADR 0042 rule 2).

          **The height is reserved**, exactly as the stats strip below it is,
          and for the identical reason: the registry answers a round trip after
          the Optin does, so a line that appeared would push the strip and the
          tab strip down after the browser had already painted. `1lh` against
          this element's own type, rather than a pixel figure that would have
          to be kept equal to the type scale.
        */}
        <div className="mt-1 flex min-h-[1lh] flex-wrap items-center gap-x-2 text-note text-muted-foreground">
          <span>{goalSaid(goalEntry, goal ?? '')}</span>

          {/*
            **Only where there is somewhere to go.** An install with one Goal
            it can serve has nothing to offer here, and a control that opens a
            picker holding only the card you already have is a control that
            wastes a click (ADR 0042 rule 2). It waits for the registry rather
            than appearing with it, which is what the reserved line above
            absorbs.
          */}
          {goals.status === 'ready' &&
            offerableGoals(goals.data, 'creation_flow', goal ?? '').length > 1 && (
              <Button
                ref={changeGoal}
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 align-baseline"
                onClick={() => setChangingGoal(true)}
              >
                {__('Change goal', 'wconvert')}
              </Button>
            )}
        </div>

        {/*
          ==================================================================
          THE HEADLINE IS THE GOAL'S OWN NUMBER, AND THE OTHER TWO SUPPORT IT.
          ==================================================================
          Three numbers at one weight is *"a card where three numbers all shout
          has no headline at all"* — {@see Stat}'s own docblock, naming the
          failure this strip had. `emphasis` is what Analytics already spends on
          the same number, so this is the existing treatment applied rather than
          a second one invented (ADR 0042 rule 5). There is no new chrome and no
          band around it: the boldness is spent in exactly one place.

          **The window is said out loud.** Analytics dates every card and this
          showed three undated numbers from `StatRange::DEFAULT_DAYS` — and *42
          submissions* means nothing without knowing over what. The words are
          the ones the Analytics selector uses, so the two screens cannot
          describe the same window differently.
        */}
        {(numbers !== null || (publishedAt !== null && stats.status === 'loading')) && (
          /*
            **One wrapper for both states, and that is what makes the height
            reservation true.** The two branches were siblings with their own
            margins and the loading one was 72px short — it had no caption line
            — so the strip still pushed the tab strip down when the numbers
            landed, which is the whole thing this exists to stop. Sharing the
            box means the only difference between them is what is inside it.
          */
          <div className="mt-4 max-w-xl">
            {numbers !== null ? (
              <>
                <StatRow>
                  {/*
                    **The precise word, and this is where it survives.** The
                    dashboard card says *"Conversions"* because one [[Goal]]'s
                    card can hold an Optin that submits beside one that links
                    away (ADR 0059) — true of both, and never wrong. Here there
                    is exactly one design, so the exact word is available and
                    is always right: it is read off the same tree the renderer
                    draws, rather than off a Goal that used to promise it.

                    **It asks the counted KIND, and that is the honest
                    question.** Naming the act is right exactly where the
                    headline IS the Conversion count; where it is read from
                    another kind the act that produced it is not what the
                    number measures — a delivery happens after the Conversion,
                    from a different process (ADR 0008) — so the kind's own
                    word stands. Branching on `needs_a_capture` gave the same
                    answer today and asked a different question: that field
                    says the number is unreachable without a field, which is a
                    fact about the DESIGN's obligations rather than about what
                    the figure is called.
                  */}
                  <Stat
                    emphasis
                    label={
                      entryOfGoal?.headline_kind === 'conversion'
                        ? act === 'click'
                          ? __('Click-throughs', 'wconvert')
                          : __('Submissions', 'wconvert')
                        : numbers.label
                    }
                    value={formatCount(numbers.report.headline)}
                  />
                  <Stat
                    label={__('Impressions', 'wconvert')}
                    value={formatCount(numbers.report.impressions)}
                  />
                  <Stat
                    label={__('Conversion rate', 'wconvert')}
                    value={formatRate(numbers.report.conversion_rate)}
                  />
                </StatRow>
                {/*
                  `mb-0` because wp-admin's own `p { margin: 1em 0 }` reaches
                  this element and preflight does not — 16px the reserved row
                  below has no way to know about, which is the whole class of
                  bug a shared wrapper exists to remove.
                */}
                <p className="mt-2 mb-0 text-body text-muted-foreground">
                  {sprintf(
                    /* translators: %s: a number of days. */
                    _n('The last %s day', 'The last %s days', numbers.days, 'wconvert'),
                    String(numbers.days),
                  )}
                </p>
              </>
            ) : (
              <>
                {/* Three: the Goal's own number, and the two that support it. */}
                <StatRowSkeleton stats={3} />
                {/*
                  The window is the SERVER's default and is not known until the
                  payload lands, so the caption is a bar of exactly one line of
                  its own type — `1lh` against `text-body` rather than a number
                  that would have to be kept equal to the type scale.
                */}
                <Skeleton aria-hidden="true" className="mt-2 h-[1lh] w-28 text-body" />
              </>
            )}
          </div>
        )}

      </PageAction>

      <div className="wconvert-builder">
        <div className="wconvert-builder__tabs">
          {/*
            **The space under the tab strip is spelled ONCE, here, and `mb-4` on
            the strip was a trap.** The vendored `Tabs` root is a flex column
            that already carries `gap-2`, and a flex gap does not collapse with
            a margin — so `mb-4` READ as 16px and RENDERED as 24px. Together
            with the strip standing 4px taller than the preview's button row,
            that is the whole of the 16px by which the two columns disagreed:
            60px to the left card, 44px to the right.

            `gap-4` on the root, `gap: 1rem` on the preview column, and a
            `min-block-size` on the preview's header row so its 32px controls
            sit centred in a 36px band. Both cards then start at 52px.
          */}
          <Tabs
            className="gap-4"
            value={tab}
            /*
              **Changing tab closes any overlay the old tab owned**, and that
              cannot be the tab's own business.

              A Radix popover portals to `document.body`, which is outside the
              `<Activity mode="hidden">` that hides a tab — so a colour picker
              opened on **Design** stayed on screen over **Content**, a tab with
              no colours in it.

              **Two obvious fixes were tried in a browser and neither works**,
              and both are recorded because both will be proposed again: an
              effect in the panel whose cleanup clears the state, on the
              strength of `Activity` unmounting effects when it hides; and
              holding the state here and clearing it in this handler.

              They fail for one reason. Radix already closes on an outside
              click, so `onOpenChange(false)` DOES fire on the tab press — what
              never happens is the re-render. By the time React processes the
              update the panel is inside a hidden `Activity`, whose subtree
              reconciles at low priority, so the state changes and the portal is
              never re-rendered. An uncontrolled popover fails identically,
              which is why this was a bug before it was controlled.

              `flushSync` is what makes the ORDER real: the close is committed
              while the tab is still visible, and only then does the tab change
              and the Activity hide. That is the documented use — forcing a
              commit before a second update depends on it — rather than a
              workaround for a slow render.

              The state lives here rather than in the panel because this is
              where a tab change happens, and the next portaled overlay on a tab
              joins this line rather than inventing its own escape.
            */
            onValueChange={(value) => {
              flushSync(() => setOpenToken(null));
              setTab(value as TabId);
            }}
          >
            <TabsList>
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

            {/*
              ================================================================
              CONTENT AND DESIGN STAY MOUNTED, AND STOP RUNNING WHILE HIDDEN.
              ================================================================
              `forceMount` is what keeps them; `<Activity mode="hidden">` is
              what makes keeping them affordable and, more importantly, SAFE.

              Affordable: React skips rendering a hidden Activity's children at
              normal priority, so the tab a merchant is not looking at is not
              re-rendered on every keystroke in the one they are.

              Safe: an Activity's effects are torn down while it is hidden, and
              this screen has effects that move FOCUS — the tree puts it back on
              a row after a redraw. A merely `hidden` tab would take the caret
              somewhere nobody can see.

              **Both of them, and Design is the addition.** Content, because
              rebuilding the tree's scroll position, its expanded rows and its
              caret on every switch would make one screen feel like several.
              Design, because it now holds a `<details>` disclosure and fifteen
              controls, and a merchant who opened *Every setting* to change two
              colours should not find it closed again on the way back from the
              preview. The other two hold nothing a re-mount loses.
            */}
            <TabsContent value="design" forceMount>
              <Activity mode={tab === 'design' ? 'visible' : 'hidden'}>
                <Region label={__('The design', 'wconvert')}>
                  {/*
                    **No `.wconvert-editor` and no `TabNote`, and both removals
                    are the same rule.**

                    `.wconvert-editor` supplies a PROSE rhythm — 0.75rem above
                    and below every `<p>` and heading — to the three editors that
                    still render WordPress's controls. This tab stopped being one
                    of those when it was rebuilt against the component
                    vocabulary, and keeping the class meant those margins landed
                    on children of a flex column that also had `gap-4`. Flex gaps
                    do not collapse with margins, so a 16px rhythm rendered as 40
                    in some places and 28 in others: nothing in the panel was the
                    distance it was written to be. One container, one rhythm.

                    *"Saves straight away, and keeps your words"* was a sentence
                    about a mechanism, permanently above a gallery, answering a
                    question nobody had asked yet — and a merchant who reads it
                    before their first click learns nothing they can act on. The
                    gallery teaches it in one press.
                  */}
                  <RegionBody className="flex flex-col gap-4">
                    {/*
                      ============================================================
                      THE TAB KEEPS THE LOOK. CHOOSING A DESIGN IS ITS OWN SURFACE.
                      ============================================================
                      **A region holds exactly one concern** (ADR 0039), and this
                      one held two: *choose a design* and *adjust the look*. At
                      three cards that was invisible; at forty the gallery swamps
                      the tokens the tab is named for, and the merchant who came
                      to change one colour scrolls past the whole library to
                      reach it.

                      So the gallery moved behind one button, and what is left is
                      the name of the design in use beside the way to change it —
                      which is also the only thing this row has to say. There is
                      no sentence above it: *"Saves straight away, and keeps your
                      words"* was deleted for exactly this reason, and the
                      picker's own header now says the part that is sharp
                      (ADR 0042 rule 2).
                    */}
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <span className="min-w-0 text-foreground">
                        {chosenName(templateId, templates)}
                      </span>
                      <Button ref={browse} variant="outline" onClick={() => setBrowsing(true)}>
                        {__('Browse designs', 'wconvert')}
                      </Button>
                    </div>

                    {/*
                      **The look, where the word Design already promised it.**
                      It was the second half of a tab called *Content*, under a
                      heading reading "How it looks" — the one question Content
                      is not about — while the tab named after choosing a design
                      offered no way to change how the chosen one looked.
                    */}
                    {entry !== null && (
                      <>
                        <Tokens
                          template={entry}
                          labels={gallery.labels}
                          openToken={openToken}
                          onOpenToken={setOpenToken}
                          /*
                            **The library entry's own tokens**, which is the
                            only thing that can answer "what have I actually
                            changed?" — an Optin's map is a snapshot of the
                            design's, so measuring against the manifest would
                            call every token the design set an override.

                            Empty where this install no longer ships the entry,
                            which is the same stance `MerchantsOwn` takes for
                            the same comparison: without something to compare
                            against, "the merchant's" and "the design's" are
                            indistinguishable and guessing costs more.
                          */
                          design={
                            templateId === undefined ? {} : (trees.get(templateId)?.tokens ?? {})
                          }
                          onChange={(next) => edit({ template: next })}
                          onError={report}
                        />
                        {adminSettings()?.dev === true && (
                          <DevExport entry={entry} onChange={(next) => edit({ template: next })} />
                        )}
                      </>
                    )}
                  </RegionBody>
                </Region>
              </Activity>
            </TabsContent>

            <TabsContent value="content" forceMount>
              <Activity mode={tab === 'content' ? 'visible' : 'hidden'}>
                <Region label={__('What it says', 'wconvert')}>
                  {entry === null ? (
                    <RegionBody className="text-muted-foreground">
                      {__('Pick a design first.', 'wconvert')}
                    </RegionBody>
                  ) : (
                    <>
                      {/*
                        **The verdict is not here any more, and it is not
                        gone.** It was a popover in a `DesignToolbar` on this
                        tab and on Design, on the argument that its scope is the
                        design. That is the smaller scope: *"nothing on this
                        design counts as a conversion"* answers **is this Optin
                        ready**, which is what {@see ReadinessPanel} above the
                        tab strip asks — so it is readable from all four tabs
                        now, read out rather than behind a press, and it still
                        opens the block it names. `problemsIn` is untouched.
                      */}
                      <StructureView
                        template={entry}
                        labels={gallery.labels}
                        act={act}
                        selected={selection?.path ?? null}
                        onSelect={chooseFromTree}
                        onChange={(next, coalesce) => edit({ template: next }, coalesce)}
                        focus={focusRow}
                        endsAt={displayRules.schedule.ends_at}
                        onSetEndDate={goToSchedule}
                      />
                    </>
                  )}
                </Region>
              </Activity>
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
                  <DisplayRules
                    vocabulary={vocabulary}
                    value={displayRules}
                    // Only an overlay competes for the screen, so only an
                    // overlay has a priority worth drawing.
                    overlay={overlay}
                    onChange={(patch) => edit(asConfigPatch(patch) as Config)}
                    reveal={revealSection}
                  />
                </RegionBody>
              </Region>
            </TabsContent>

            {/*
              **No `Region` wrapper here any more**, because the editor draws
              its own — along with its header, its empty state and its failure.
              It was the one screen in the admin using none of the shared
              vocabulary, and wrapping it in a region from outside was how a
              bare `<h3>` came to sit under a region that already had a name.
            */}
            <TabsContent value="destinations">
              <DestinationsEditor
                bound={bound}
                available={
                  destinations.status === 'ready'
                    ? ready(destinations.data.destinations)
                    : destinations
                }
                /*
                  **The [[Playbook]]'s hint, only while nothing is bound.**
                  Once the merchant has chosen, what the Playbook wanted is
                  history — and a permanent line that does not change what
                  they do next is the tax ADR 0042 rule 2 refuses. The
                  readiness panel above applies the same test to the same
                  sentence.
                */
                hint={
                  bound.length > 0
                    ? null
                    : hintSaid(
                        hintIn(config),
                        read(destinations)?.types ?? [],
                        gallery.labels.fields,
                        // What is already CONFIGURED, which decides whether
                        // the hint's type half is still guidance or is
                        // history — and whether it ends with where to go.
                        read(destinations)?.destinations ?? [],
                      )
                }
                onChange={(next) => edit({ destinations: next })}
              />
            </TabsContent>
          </Tabs>
        </div>

        <PreviewColumn
          entry={entry}
          step={{ value: step, onChange: setStep }}
          device={{ value: device, onChange: setDevice }}
          /*
            **The outline says "this is the block you are working on", so it
            goes when the merchant stops working on blocks.** Left up over the
            rules tab it is a highlight with nothing on screen explaining it —
            the affordance reading as decoration, which is the one thing
            ADR 0037 asks this admin not to do.

            The SELECTION is not cleared with it, which is the change the merge
            made necessary. It used to be, because the outline was all it drove;
            it now also decides what the inspector is showing, and a merchant
            returning from the rules to an editor with no block open would meet
            an empty panel for a reason nothing on screen explains.
          */
          selected={tab === 'content' ? (selection?.key ?? null) : null}
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

      {/*
        **Choosing a design owns the screen until it is answered** (ADR 0042
        rule 7), and it is the one edit that is not a value in a field: it takes
        a fresh SNAPSHOT of the design, carrying the merchant's words across by
        [[Slot Role]], and the snapshot boundary is the server's (ADR 0010).
        Taking it at the click is what lets the panel underneath show the design
        that was actually stored rather than a guess at what the save will
        produce.

        Rendered outside the tabs, like the confirm above it, because a Radix
        dialog portals to `document.body` and the Design tab lives inside an
        `<Activity mode="hidden">` — a picker owned by a hidden tab is a picker
        whose close never re-renders.
      */}
      <TemplatePickerDialog
        open={browsing}
        onOpenChange={(next) => {
          setBrowsing(next);

          // Radix restores focus to its own trigger, and this dialog has none:
          // it is opened from a button that stays on a tab which may itself be
          // hidden by the time it closes. Naming the control is what puts the
          // caret back rather than on `<body>` — the same fix `ConfirmDialog`
          // needed and for the same reason.
          if (!next) {
            browse.current?.focus();
          }
        }}
        index={gallery}
        trees={trees}
        displayType={displayTypeOf(config, templates)}
        chosen={templateId}
        /*
          **Everything that can refuse a design on THIS Optin, as one value.**
          It was the Goal's converting act, and the gallery greyed out every
          design offering the other one — five of seven popup cards, saying
          *"your goal counts click-throughs"* and naming no way to change a
          goal. The act is the design's now (ADR 0059), so what is left is
          about the Optin: what its Goal needs of a capture, whether it binds
          [[Destination]]s, what its A/B siblings convert on, and what it
          converts on today.
        */
        fit={{
          needsACapture: entryOfGoal?.needs_a_capture === true,
          bound: bound.length > 0,
          sibling: siblingAct,
          act,
        }}
        busy={busy}
        onNear={want}
        onChoose={(picked) => {
          setBrowsing(false);
          void save({ ...config, template_id: picked });
        }}
      />

      {/*
        **The other dialog rendered outside the tabs**, for the picker's own
        reason: a Radix dialog portals to `document.body`, and one owned by a
        tab inside an `<Activity mode="hidden">` is one whose close never
        re-renders. This one is opened from the page-header band rather than
        from a tab, so it never had that problem — it sits here because both
        dialogs belonging to this screen belong in one place.

        **The config travels with the Goal, always.** The pair is what the
        server checks, and sending the Goal alone would have it answered against
        whatever was last stored rather than against the design on screen
        (ADR 0059). It is the current `config` and not an edit, so the save is
        the merchant's own draft going up unchanged beside the correction.
      */}
      <ChangeGoalDialog
        open={changingGoal}
        onOpenChange={(next) => {
          setChangingGoal(next);

          // Radix restores focus to its own trigger and this dialog has none,
          // exactly as the picker above: naming the control is what puts the
          // caret back rather than on `<body>`.
          if (!next) {
            changeGoal.current?.focus();
          }
        }}
        goals={goals}
        current={goal ?? ''}
        captures={captures.length > 0}
        onChange={(picked) => void save(config ?? {}, picked)}
      />
    </div>
  );
}

/**
 * A value this column shows and the control that changes it, as one thing.
 *
 * The step and the device are two **controlled pairs**: a value the parent
 * holds and the setter that moves it, meaningless apart. Spelled as four props
 * they read as four independent inputs, and a caller could hand over a device
 * with no way to change it — a toggle that does nothing, which the types would
 * have allowed. `value`/`onChange` rather than names of this file's own,
 * because that is what every controlled component in this tree already spells.
 */
interface Controlled<T> {
  readonly value: T;
  readonly onChange: (next: T) => void;
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
  device,
  selected,
  onSelect,
}: {
  entry: TemplateEntry | null;
  step: Controlled<number>;
  device: Controlled<Device>;
  selected: SlotKey | null;
  onSelect: (key: SlotKey) => void;
}) {
  const steps = entry?.tree.steps.length ?? 0;
  const shown = Math.min(step.value, Math.max(steps - 1, 0));
  const measure = device.value === 'mobile' ? PHONE_WIDTH : (entry?.tokens.width ?? OWN_WIDTH);

  return (
    <aside className="wconvert-builder__preview" aria-label={__('Preview', 'wconvert')}>
      <div className="wconvert-builder__bar flex flex-wrap items-center justify-between gap-2">
        {/*
          **`.wconvert-segmented` is the same control the tab strip is**, and
          which answer is current is decided there rather than here — see
          `index.css`. It was `variant="secondary"` on the selected one, which
          paints `--secondary`: the same `#eef3f4` as `--muted` and as the
          group's own background, so the selection was exactly the colour of the
          box it sat in and a merchant could not tell which step they were
          looking at.

          Every button is `ghost` now. A variant that means "selected" is a
          second place for that decision to live, and this screen had four.
        */}
        {steps > 1 ? (
          <div className="wconvert-segmented flex flex-wrap">
            {entry?.tree.steps.map((_node, index) => (
              <Button
                key={index}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={index === shown}
                onClick={() => step.onChange(index)}
              >
                {/*
                  Terminal is STRUCTURAL — the success state is the last step
                  rather than a flagged one (ADR 0025) — so the name follows
                  from the position and there is no second spelling to keep in
                  step. The block tree names its step rows from the same
                  function, which is what "no second spelling" now means
                  literally rather than only in spirit.
                */}
                {stepName(index + 1)}
              </Button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="wconvert-segmented flex">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-pressed={device.value === 'desktop'}
            onClick={() => device.onChange('desktop')}
          >
            <Monitor aria-hidden="true" />
            <span className="sr-only">{__('Desktop', 'wconvert')}</span>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-pressed={device.value === 'mobile'}
            onClick={() => device.onChange('mobile')}
          >
            <Smartphone aria-hidden="true" />
            <span className="sr-only">{__('Mobile', 'wconvert')}</span>
          </Button>
        </div>
      </div>

      <div
        className="wconvert-builder__stage"
        data-device={device.value}
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
 * Undo and Redo, beside the title they act on.
 *
 * **Icon-only, because their icons are two of the most universally understood
 * in software** and a labelled pair in a page header competes with the one
 * action that matters there. The name is still said — `sr-only` for a screen
 * reader, `title` for a pointer — so nothing is lost but the width.
 *
 * They stand at `--control-height-sm` rather than the band's own height: they
 * qualify the draft rather than committing it, which is ADR 0039's test, and it
 * is what keeps `Save changes` the only full-height control on the line.
 */
function HistoryControls({
  history,
}: {
  readonly history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  };
}) {
  const label = { undo: __('Undo', 'wconvert'), redo: __('Redo', 'wconvert') };

  return (
    <span className="wconvert-history">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={label.undo}
        disabled={!history.canUndo}
        onClick={history.undo}
      >
        <Undo2 aria-hidden="true" />
        <span className="sr-only">{label.undo}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={label.redo}
        disabled={!history.canRedo}
        onClick={history.redo}
      >
        <Redo2 aria-hidden="true" />
        <span className="sr-only">{label.redo}</span>
      </Button>
    </span>
  );
}

/*
 * ============================================================================
 * `TabNote` IS GONE, AND THE ARGUMENT THAT KILLED IT IS ITS OWN.
 * ============================================================================
 * It existed for *"a sentence a tab needs before its editor starts"*, and its
 * docblock made the case that a tab strip already names what is under it — the
 * reason these regions carry no `RegionHeader`, after "Where it shows" was
 * printed three times before a single control.
 *
 * The same argument finishes the job. Its one surviving call site read *"Saves
 * straight away, and keeps your words"* above the design gallery: a sentence
 * about a mechanism, permanently on screen, answering a question a merchant has
 * not asked yet and cannot act on. A tab that needs a sentence before its first
 * control usually needs a better first control, and the gallery teaches this one
 * in a single press.
 *
 * Restored, if a tab ever genuinely needs one, as {@see Description} — which is
 * all this was.
 */

/**
 * The [[Display Type]] to assume where nothing on screen names one.
 *
 * **Every install has popups and only Pro has the other three**, so this is the
 * one answer that is true everywhere — which is why the two readers below reach
 * for it and why it is spelled once. The comment above `displayTypeOf` used to
 * claim its fallback avoided "a name spelled here" while spelling it, and
 * {@see entryFor} spelled it a second time on the next screen down.
 */
const EVERY_INSTALL_HAS = 'popup';

/**
 * The rules patch, with the schedule taken back apart into the two flat keys
 * `config` stores it as.
 *
 * ============================================================================
 * ONE CONTROL, ONE PATCH, TWO KEYS — AND THE FLAT SHAPE IS THE STORED ONE.
 * ============================================================================
 * `starts_at` and `ends_at` sit at the top of `config` beside `frequency` and
 * `priority`, which is what `PublishedProjection` reads and what
 * `src/Optin/Schedule.php` normalises. The rules panel holds them as one
 * object because one control writes both and a merchant clearing a window
 * should be one undo step rather than two.
 *
 * **`undefined` rather than a delete**, because {@link edit} is a shallow
 * merge over the current config: a key can only be REMOVED by being
 * overwritten. `JSON.stringify` drops an undefined value, so what reaches the
 * save route is a config with no such key rather than one carrying a null the
 * normaliser would then have to have an opinion about.
 */
function asConfigPatch(patch: Partial<DisplayRulesValue>): Record<string, unknown> {
  if (patch.schedule === undefined) {
    return patch as Record<string, unknown>;
  }

  const { schedule, ...rest } = patch;

  return { ...rest, starts_at: schedule.starts_at, ends_at: schedule.ends_at };
}

/**
 * Which [[Display Type]]'s designs the gallery shows.
 *
 * **Not the first question asked.** Users arrive via a [[Goal]] and the type
 * is prefilled by the chosen [[Playbook]]; it is an override and a filter, and
 * never the primary axis of the product (CONTEXT.md, Display Type). So it is
 * read off the Optin first.
 *
 * Where the Optin does not declare one, the shipped library decides: the day
 * Pro's floating bars and slide-ins land, an install whose first entry is one
 * of them follows it without this line changing. The constant is reached only
 * by an install shipping no designs at all, which has no gallery to filter.
 */
function displayTypeOf(config: Config, templates: readonly TemplateIndexEntry[] | undefined): string {
  const declared = config.display_type;

  return typeof declared === 'string' ? declared : (templates?.[0]?.display_type ?? EVERY_INSTALL_HAS);
}

/**
 * The design in use, by name — the whole of what the Design tab says about
 * choosing one now that the gallery is behind a button.
 *
 * Its own line rather than a heading, because it answers a question the
 * merchant has (*which one am I on?*) and asserts nothing else. An Optin whose
 * entry this install no longer ships shows its id, which is the same fallback
 * {@see entryFor} takes and for the same reason: the id is provenance, and an
 * Optin that arrived from an entry we no longer carry is not a broken Optin.
 */
function chosenName(
  templateId: string | undefined,
  templates: readonly TemplateIndexEntry[] | undefined,
): string {
  if (templateId === undefined) {
    return __('No design chosen yet.', 'wconvert');
  }

  return templates?.find((each) => each.id === templateId)?.name ?? templateId;
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
  templates: readonly TemplateIndexEntry[],
): TemplateEntry {
  const source = templates.find((each) => each.id === templateId);

  return {
    id: templateId ?? 'optin',
    name: source?.name ?? (templateId ?? ''),
    display_type: source?.display_type ?? EVERY_INSTALL_HAS,
    // Carried so the dev-only export writes the library entry a design would
    // ACTUALLY ship as: `tier` is one of the entry's five keys now, and an
    // export missing it is an entry that reads as free by default rather than
    // by decision (`entry.ts`).
    tier: source?.tier,
    tree: template.tree,
    tokens: template.tokens,
  };
}
