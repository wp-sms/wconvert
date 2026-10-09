import { useId } from 'react';
import { __ } from '@wordpress/i18n';
import { Preview } from '@/builder/Preview';
import { NativeSelect } from '@/components/ui/native-select';
import type { ContentLockPreviewProps, ContentLockPreviewState } from '@/inlinePlacement';
import '../../inline-placement/admin/placement.css';

export function LockPreviewControls({ state, onStateChange }: ContentLockPreviewProps) {
  const id = useId();
  return <div className="wconvert-content-lock-controls">
    <label htmlFor={id}>{__('Preview content lock', 'wconvert')}</label>
    <NativeSelect id={id} value={state} onChange={event => onStateChange(event.target.value as ContentLockPreviewState)}>
      <option value="locked">{__('Locked', 'wconvert')}</option>
      <option value="unlocked">{__('Unlocked', 'wconvert')}</option>
      <option value="unavailable">{__('Form unavailable', 'wconvert')}</option>
    </NativeSelect>
    <span>{__('Example content. No data is sent.', 'wconvert')}</span>
  </div>;
}

export default function LockPreview({ template, state, onStateChange }: ContentLockPreviewProps) {
  return <div className="wconvert-content-lock-example rounded border bg-card p-4" aria-label={__('Content lock example', 'wconvert')}>
    <p>{__('Public introduction', 'wconvert')}</p>
    {state !== 'unavailable' && <Preview template={template} displayType="inline" interactive
      step={state === 'locked' ? 0 : template.tree.steps.length - 1} onAdvance={() => onStateChange('unlocked')} />}
    <p>{state === 'locked' ? __('Hidden until submission.', 'wconvert') : __('Revealed content.', 'wconvert')}</p>
    {state === 'unavailable' && <p>{__('No submission recorded.', 'wconvert')}</p>}
  </div>;
}
