import type { ComponentType } from 'react';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import type { JourneyRepair } from './builder/structure/journeyReadiness';

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

export interface ResultSlotProps {
  tree: TemplateTree;
  step: number;
  onChange(next: TemplateTree, coalesce?: string): void;
  onAction?(message: string): void;
  onResultSelect?(id: string | undefined): void;
  repairRequest?: JourneyRepair & { readonly serial: number };
}

export interface ScreenConditionSlotProps {
  tree: TemplateTree;
  step: number;
  /** A new value opens the disclosure: a repair asked for it. */
  reveal?: number;
  onChange(next: TemplateTree): void;
  onSelect(step: number): void;
}

/** "Where visitors go next": a graph's answer lines, or a linear campaign's paths. */
export interface RouteSlotProps {
  tree: TemplateTree;
  step: number;
  focusPath: number | 'hidden' | null;
  /** Focus the line's Then select rather than its condition. */
  focusTarget?: boolean;
  onChange(next: TemplateTree): void;
  onSelect(step: number): void;
  /** A screen added on a graph line. */
  onInsertOnEdge(edgeId: string, kind: 'content' | 'input'): void;
  /** A screen added on a linear campaign's line, by its priority. */
  onInsertOnPath(priority: number, kind: 'content' | 'input'): void;
  onOpenInsert?(edgeId: string): void;
  onAdd?(intent: 'followup' | 'branch'): void;
  /** Drawn inside its own titled section, as the question panel shows it. */
  titled?: boolean;
}

export const journeyAuthoring: {
  question?: ComponentType<QuestionSlotProps>;
  result?: ComponentType<ResultSlotProps>;
  screenCondition?: ComponentType<ScreenConditionSlotProps>;
  route?: ComponentType<RouteSlotProps>;
} = {};
