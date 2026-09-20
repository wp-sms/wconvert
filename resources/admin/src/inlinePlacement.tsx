import { Suspense, type ComponentType } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { Rule, RuleVocabulary } from './builder/api';
import { Button } from './components/ui/button';
import { ManualPlacement } from './builder/ManualPlacement';

export interface InlinePlacementProps {
  optinId: string;
  published: boolean;
  config: Record<string, unknown>;
  vocabulary: RuleVocabulary;
  onChange: (changes: Record<string, unknown>) => void;
}

/** Composition-time slot: Free never imports premium authoring controls. */
export const inlinePlacementControls: { component?: ComponentType<InlinePlacementProps> } = {};

export function usesPageLoadOnly(rules: readonly Rule[], vocabulary: RuleVocabulary): boolean {
  const names = new Set(vocabulary.triggers.map((rule) => rule.type));
  const triggers = rules.filter((rule) => names.has(rule.type));
  return triggers.length === 1 && triggers[0].type === 'page_load';
}

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
    <div className="wconvert-inline-placement">{props.config.content_lock != null && <p>{__('Content lock requires Pro. The selected region stays readable.', 'wconvert')}</p>}<p>{props.config.inline_placement
      ? __('Automatic placement requires Pro. You can still place this Campaign manually with its block or shortcode.', 'wconvert')
      : __('Place this Campaign with its block or shortcode. Automatic placement is included in Pro.', 'wconvert')}</p>
      {(props.config.inline_placement != null || props.config.content_lock != null) && <Button variant="outline" onClick={() => props.onChange({ inline_placement: null, content_lock: null })}>{__('Use manual placement', 'wconvert')}</Button>}
      {props.config.inline_placement == null && <ManualPlacement optinId={props.optinId} published={props.published} />}
    </div>
  );
}
