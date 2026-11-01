import type { ComponentType } from 'react';
import type { Template } from '@renderer/types';
import type { RuleVocabulary } from './builder/api';

/**
 * The inline placement slots, alone: what Pro's entry writes at load.
 *
 * Apart from `inlinePlacement.tsx` because that file reaches the builder's
 * structure helpers and, through them, the renderer — so Pro's entry
 * importing it for this object put the renderer in Pro's main file (#397).
 */
export interface InlinePlacementProps {
  optinId: string;
  published: boolean;
  config: Record<string, unknown>;
  vocabulary: RuleVocabulary;
  onChange: (changes: Record<string, unknown>) => void;
}

export type ContentLockPreviewState = 'locked' | 'unlocked' | 'unavailable';
export interface ContentLockPreviewProps {
  template: Template;
  state: ContentLockPreviewState;
  onStateChange(state: ContentLockPreviewState): void;
}

/** Composition-time slots: Free never imports premium authoring controls. */
export const inlinePlacementControls: {
  component?: ComponentType<InlinePlacementProps>;
  preview?: ComponentType<ContentLockPreviewProps>;
  previewControls?: ComponentType<ContentLockPreviewProps>;
} = {};
