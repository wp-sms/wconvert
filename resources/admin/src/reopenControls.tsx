import { Suspense, type ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import type { Template } from '@renderer/types';

export interface ReopenProps {
  value: unknown;
  template: Template;
  onChange(value: unknown): void;
}
export interface ReopenPreviewProps {
  value: unknown;
  template: Template;
  mobile: boolean;
  onReopen(): void;
}
export const reopenControls: {
  component?: ComponentType<ReopenProps>;
  preview?: ComponentType<ReopenPreviewProps>;
} = {};

export function ReopenPreview(props: ReopenPreviewProps) {
  const Preview = reopenControls.preview;
  return Preview ? <Suspense fallback={null}><Preview {...props} /></Suspense> : null;
}

export function ReopenSettings(props: ReopenProps) {
  const Control = reopenControls.component;
  return Control ? <Suspense fallback={<p>{__('Loading reopen settings…', 'wconvert')}</p>}><Control {...props} /></Suspense> : (
    <p>{props.value ? __('This Campaign has a reopen button. Its settings are saved, but showing it requires Pro.', 'wconvert') : __('Let visitors reopen a dismissed Campaign with a small button. Included in every Pro plan.', 'wconvert')}</p>
  );
}
