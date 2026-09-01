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
import { __ } from '@wordpress/i18n';
import { Check, Monitor, Redo2, Smartphone, Undo2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BackLink, BuilderSkeleton } from '../shell/BuilderSkeleton';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionError, RegionErrorState } from '../shell/Region';
import { Stat, StatRow } from '../shell/Stat';
import { messageOf } from '../shell/loadable';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { useTemplateTrees } from './TemplatePicker';
import { DesignToolbar } from './DesignToolbar';
import { DestinationsEditor } from './DestinationsEditor';
import { Preview } from './Preview';
import { DisplayRules } from './rules/DisplayRules';
import { DevExport } from './DevExport';
import { StructureView } from './StructureView';
import { Tokens } from './Tokens';
import { canRedo, canUndo, historyOf, redo, remember, undo, type History } from './structure/history';
import { firstBlockOf, nearestTo, samePath } from './structure/tree';
import type { ConvertingAct } from './structure/catalogue';
import { listGoals } from '../goals/api';
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
  const [stats, setStats] = useState<OptinNumbers | null>(null);
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
   * Which act this Optin's [[Goal]] is measured by, read off the same route the
   * creation flow reads. **No Goal id and no act mapping is spelled in this
   * bundle** — `goals/api.ts` says why, and `GoalParityTest` fails the day one
   * appears. Null until it lands, which only delays the Add menu's button row.
   */
  const [act, setAct] = useState<ConvertingAct | null>(null);
  /*
   * **A row the screen has asked the tree to put focus on.** The verdict chip
   * is the only thing that asks: following *"this block will lose its words"*
   * to the block it names is a selection AND focus on that row, and the chip
   * now lives in {@see DesignToolbar} on either of two tabs rather than inside
   * the tree. A fresh object per request, because identity is the signal —
   * asking twice for the same row has to be two requests.
   */
  const [focusRow, setFocusRow] = useState<{ path: Path } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  /** See the history effect below: which control the pending change came from. */
  const coalescing = useRef<string | null>(null);

  const report = useCallback((cause: unknown) => setError(messageOf(cause)), []);

  const template = config?.template as Template | undefined;
  const templateId = typeof config?.template_id === 'string' ? config.template_id : undefined;
  const templates = gallery?.templates;

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
   * **Which converting act this Optin's Goal is measured by**, so the structure
   * editor can offer the right button and refuse a form on an Optin that
   * captures nothing (ADR 0025).
   *
   * Read from the registry rather than mapped here. Three of the five Goals are
   * submissions and two are clicks, and a copy of that table in this bundle
   * would be a cross-language list with nothing asserting the two agree — the
   * fifth one this project has refused (ADR 0019), and the reason
   * `goals/api.ts` names no Goal id either.
   *
   * Its failure is swallowed, like the numbers below it: without it the Add
   * menu cannot offer a button, and nothing else on this screen is affected. An
   * editor that refused to open because a lookup failed would be a worse answer
   * than an Add menu one item short.
   */
  useEffect(() => {
    if (goal === null) {
      return;
    }

    listGoals()
      .then((goals) => {
        const found = goals.find((each) => each.id === goal)?.converting_act;

        setAct(found === 'click' || found === 'submit' ? found : null);
      })
      .catch(() => undefined);
  }, [goal]);

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
      .then((payload) => setStats(numbersByOptin(payload)[id] ?? null))
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
            <HistoryControls history={history} />

            <Button disabled={busy} onClick={() => void save()}>
              {__('Save changes', 'wconvert')}
            </Button>
          </div>
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
                    **The same toolbar the Content tab has, because its scope is
                    the design and this tab edits the design.** Applying a
                    preset is one undo entry and so is picking a gallery card;
                    without this, taking either back meant knowing that Undo
                    lived on another tab. The verdict is here for the mirror
                    reason: the contrast failures it reports are caused by the
                    colours chosen a few inches below it.
                  */}
                  {entry !== null && (
                    <DesignToolbar
                      template={entry}
                      act={act ?? 'submit'}
                      onGoTo={goTo}
                    />
                  )}
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
                      <DesignToolbar
                        template={entry}
                        act={act ?? 'submit'}
                        onGoTo={goTo}
                      />
                      <StructureView
                        template={entry}
                        labels={gallery.labels}
                        act={act ?? 'submit'}
                        selected={selection?.path ?? null}
                        onSelect={chooseFromTree}
                        onChange={(next, coalesce) => edit({ template: next }, coalesce)}
                        focus={focusRow}
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
                    value={{
                      rules: Array.isArray(config.rules) ? (config.rules as Rule[]) : [],
                      targeting: (config.targeting ?? {}) as Targeting,
                      frequency: (config.frequency ?? {}) as Frequency,
                      // Absent and zero are the same rule — `arbitrate()`
                      // reads `priority ?? 0`, and the save route drops a
                      // stored 0 for exactly that reason.
                      priority: typeof config.priority === 'number' ? config.priority : 0,
                    }}
                    // Only an overlay competes for the screen, so only an
                    // overlay has a priority worth drawing.
                    overlay={displayTypeOf(config, templates) !== 'inline'}
                    onChange={(patch) => edit(patch as Config)}
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
        act={act ?? 'submit'}
        busy={busy}
        onNear={want}
        onChoose={(picked) => {
          setBrowsing(false);
          void save({ ...config, template_id: picked });
        }}
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
