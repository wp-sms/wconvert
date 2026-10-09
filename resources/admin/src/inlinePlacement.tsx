import type { Template } from '@renderer/types';
import { convertingActOf } from './builder/structure/guards';
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

export function ContentLockPreview(props: ContentLockPreviewProps & { controls?: boolean }) {
  const Component = props.controls ? inlinePlacementControls.previewControls : inlinePlacementControls.preview;
  return Component ? <Suspense fallback={null}><Component {...props} /></Suspense> : null;
}

export function usesPageLoadOnly(rules: readonly Rule[], vocabulary: RuleVocabulary): boolean {
  const names = new Set(vocabulary.triggers.map((rule) => rule.type));
  const triggers = rules.filter((rule) => names.has(rule.type));
  return triggers.length === 1 && triggers[0].type === 'page_load';
}

export function inlinePlacementLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('position' in value)) return null;
  if (value.position === 'before_content') return __('Automatically before content', 'wconvert');
  if (value.position === 'after_product_summary') return __('After the WooCommerce product summary (classic themes)', 'wconvert');
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
    <div className="wconvert-inline-placement">{props.config.content_lock != null && <p className="wconvert-display-hint" data-attention="true">{__('Content lock isn’t available on this site. The selected region stays readable.', 'wconvert')}</p>}<p className="wconvert-display-hint">{props.config.inline_placement
      ? __('Automatic placement isn’t available on this site. You can still place this Campaign manually with its block or shortcode.', 'wconvert')
      : __('Place this Campaign with its block or shortcode.', 'wconvert')}</p>
      {(props.config.inline_placement != null || props.config.content_lock != null) && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => props.onChange({ inline_placement: null, content_lock: null })}>{__('Use manual placement', 'wconvert')}</Button>}
      {props.config.inline_placement == null && <ManualPlacement optinId={props.optinId} published={props.published} />}
    </div>
  );
}

export function contentLockDesignCompatible(displayType: string, template: Template): boolean {
  return displayType === 'inline' && convertingActOf(template.tree).join() === 'submit' && template.tree.steps.at(-1)?.kind === 'acknowledgement';
}
