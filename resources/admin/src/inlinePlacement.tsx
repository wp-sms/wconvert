import { Suspense, type ComponentType } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { RuleVocabulary } from './builder/api';

export interface InlinePlacementProps {
  config: Record<string, unknown>;
  vocabulary: RuleVocabulary;
  onChange: (changes: Record<string, unknown>) => void;
}

/** Composition-time slot: Free never imports premium authoring controls. */
export const inlinePlacementControls: { component?: ComponentType<InlinePlacementProps> } = {};

export function inlinePlacementLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('position' in value)) return null;
  if (value.position === 'before_content') return __('Automatically before content', 'wconvert');
  if (value.position === 'after_content') return __('Automatically after content', 'wconvert');
  if (value.position === 'after_paragraph' && 'paragraph' in value && typeof value.paragraph === 'number'
    && Number.isInteger(value.paragraph) && value.paragraph >= 1 && value.paragraph <= 100) {
    return sprintf(__('Automatically after paragraph %d', 'wconvert'), Number(value.paragraph));
  }
  return null;
}

export function InlinePlacementSettings(props: InlinePlacementProps) {
  const Control = inlinePlacementControls.component;
  return Control ? <Suspense fallback={<p>{__('Loading placement settings…', 'wconvert')}</p>}><Control {...props} /></Suspense> : (
    <p>{props.config.inline_placement
      ? __('Automatic placement requires Pro. You can still place this Campaign manually with its block or shortcode.', 'wconvert')
      : __('Place this Campaign with its block or shortcode. Automatic placement is included in Pro.', 'wconvert')}</p>
  );
}
