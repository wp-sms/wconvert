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
    // Reached only where the module that draws the button is absent, so it
    // speaks only about a saved setting and sells nothing (ADR 0116).
    props.value ? <p>{__('This campaign has a reopen button saved. It isn’t shown on this site.', 'wconvert')}</p> : null
  );
}
