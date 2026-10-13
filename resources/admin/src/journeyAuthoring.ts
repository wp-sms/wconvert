import type { ComponentType, ReactNode, RefObject } from 'react';
import type { QuestionNode, TemplateScreen, TemplateTree } from '@renderer/types';
import type { JourneyRepair } from './builder/structure/journeyReadiness';
import type { Refusal } from './components/ui/option-menu';

/**
 * Journey authoring — questions, results, "Only if…" and answer lines — as
 * slots Pro's `journeys` module fills (ADR 0147).
 *
 * Free's bundle carries none of these editors, so nothing here is a feature
 * switched off by a filter (wp.org guideline 5). `journeysSupported()` stays
 * the server's word on whether the module shipped; an empty slot while it is
 * true is a build bug, and Pro's entry test catches it.
 *
 * Free keeps linear screens, the read-only Flow map, the neutral repair notice
 * and deleting screens, so a journey draft opened here can still be cleared.
 */

/** Where an answer's review was when a rule it names was opened, so Back resumes it. */
export interface QuestionReviewContext {
  questionId: string;
  choiceValue?: string;
  replacement: string;
  retiring: boolean;
  answerType?: QuestionNode['answer_type'];
}

export interface QuestionSlotProps {
  tree: TemplateTree;
  step: number;
  onChange(next: TemplateTree, coalesce?: string): void;
  onSelect(step: number): void;
  onNavigate?(repair: JourneyRepair, review: QuestionReviewContext): void;
  resumeReview?: QuestionReviewContext & { serial: number };
  onFollowup?(question: string, value: string): void;
  /** Says what a change did, in the editor's status line. */
  onAction?(message: string): void;
}

/**
 * What the screens editor lends Pro's authoring: the draft, where the panel
 * is, and the editor's own moves. Every journey decision is made on Pro's side.
 */
export interface JourneyEditorContext {
  tree: TemplateTree;
  step: number;
  primaryChannel?: string | null;
  /** The Edit tab's slim screen panel (ADR 0135). */
  slim: boolean;
  panelSection: 'content' | 'paths';
  pathFocus: number | 'hidden' | null;
  repairRequest?: JourneyRepair & { readonly serial: number };
  resumeReview?: QuestionReviewContext & { serial: number };
  /** The "Add screen" control focus returns to. */
  addTrigger: RefObject<HTMLButtonElement | null>;
  settingsHeading: RefObject<HTMLHeadingElement | null>;
  /** Why a campaign without lines takes no more screens, or null while it can. */
  capRefusal: Refusal | null;
  onChange(next: TemplateTree, coalesce?: string): void;
  onResultSelect?(id: string | undefined): void;
  /** Opens a screen, as a click on it does. */
  select(index: number): void;
  /** Commits a structural change and opens screen `index`. */
  write(next: TemplateTree, index: number): void;
  /** Free's linear insertion after the open screen; `make` builds the screen for its index. */
  insertScreen(make: (at: number) => TemplateScreen): void;
  /** The editor's own "Optional signup", which asks Pro for a graph. */
  addOptional(): void;
  /** One line in the editor's status bar, about a screen. */
  say(text: string, screen?: TemplateScreen): void;
  showSection(section: 'content' | 'paths'): void;
  /** Narrow: show the panel rather than the map. */
  showDetails(): void;
  showFlow(): void;
  /** Where Back returns: the open screen, and the review it was in. */
  returnHere(review?: QuestionReviewContext): void;
  /** Opens what a rule names, as a repair would. */
  openReference(repair: JourneyRepair): void;
}

/** Pro's journey authoring, as pieces the screens editor places. Free has none. */
export interface JourneyAuthoringUI {
  /** One of its own dialogs is open, so Escape is not the editor's. */
  busy: boolean;
  /** Another screen was opened. */
  reset(): void;
  /** Adds a question, a follow-up, or any screen to a campaign with lines. */
  add(kind: 'content' | 'input', conditional?: boolean): void;
  /** "Optional signup" on a campaign with lines. */
  addOptional(): void;
  canAddOptional: boolean;
  capHelp?: string;
  /** Question items for the Edit tree's "Add screen" menu, and the screen manager's. */
  treeAddItems: ReactNode;
  headerAddItems: ReactNode;
  /** "Let answers choose the next screen". */
  answersGroup: ReactNode;
  /** The screen manager's "Add screen" button. */
  headerAdd: ReactNode;
  dialogs: ReactNode;
  question: ReactNode;
  questionPanel: ReactNode;
  route: ReactNode;
  screenCondition: ReactNode;
  then: ReactNode;
  followup?(question: string, option: { value: string; label: string }): ReactNode;
  followupOrder: ReactNode;
  result: ReactNode;
  nextSummary: ReactNode;
  flowNudge: ReactNode;
  flowAdd?(index: number, edgeId: string): void;
  screenItems: ReactNode;
  screenPanel: ReactNode;
  /** Answer lines are editable, so the screen has a Lines section. */
  lines: boolean;
}

export const journeyAuthoring: {
  /** The question element's settings, for the element inspector outside the screens editor. */
  question?: ComponentType<QuestionSlotProps>;
  /** A hook: called on every render of the screens editor, so registered once, before it mounts. */
  useAuthoring?(context: JourneyEditorContext): JourneyAuthoringUI;
} = {};
