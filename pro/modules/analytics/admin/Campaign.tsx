import { useEffect, useId, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Input } from '@/components/ui/input';
import { Field } from '@/shell/Field';
import { OptionStrip } from '@/shell/OptionStrip';
import { TryAgain } from '@/shell/Region';
import { failed, type Loadable } from '@/shell/loadable';
import type { CampaignAnalyticsProps } from '@/analyticsIntegration';
import { editorHref } from '@/nav';
import { path, type Response } from './api';

export default function Campaign({ value, parentId, onChange }: CampaignAnalyticsProps) {
  const preference = value as { off?: boolean; label?: string } | undefined;
  const labelId = useId();
  const [enabled, setEnabled] = useState<Loadable<boolean>>({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (parentId) return;
    let active = true;
    setEnabled({ status: 'loading' });
    apiFetch<Response>({ path }).then(response => {
      if (active) setEnabled({ status: 'ready', data: response.settings.enabled });
    }).catch(reason => { if (active) setEnabled(failed(reason)); });
    return () => { active = false; };
  }, [parentId, retry]);
  if (parentId) return <p className="m-0">{__('This variant uses its campaign family’s analytics preferences.', 'wconvert')} <a href={editorHref(parentId)}>{__('Open parent campaign', 'wconvert')}</a></p>;
  return <div className="flex flex-col gap-3">
    <div className="grid gap-2">
      <span aria-hidden="true" className="font-medium">{__('Analytics tracking', 'wconvert')}</span>
      <OptionStrip label={__('Analytics tracking', 'wconvert')} value={preference?.off ? 'off' : 'site'}
        options={[{ value: 'site', label: __('Use site setting', 'wconvert') }, { value: 'off', label: __('Off for this campaign', 'wconvert') }]}
        onChange={choice => onChange({ ...preference, off: choice === 'off' })} />
    </div>
    {/* One sentence about the site setting, not a region: a fact inside a form. */}
    {enabled.status === 'loading' ? <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading site analytics…', 'wconvert')}</p>
      : enabled.status === 'failed' ? <div role="alert" className="flex flex-wrap items-center gap-3 text-note text-destructive"><span>{enabled.message}</span><TryAgain onClick={() => setRetry(n => n + 1)} /></div>
      : <p className="m-0 text-note">{enabled.data ? __('Published preferences apply to enabled external analytics and campaign sales, subject to consent.', 'wconvert') : __('External analytics is off. Campaign sales has a separate site setting.', 'wconvert')}</p>}
    <p className="m-0 text-note text-muted-foreground">{__('Off excludes this campaign from external analytics and sales attribution. Its own results still count.', 'wconvert')}</p>
    <Field label={__('Public analytics label (optional)', 'wconvert')} htmlFor={labelId} hintId={`${labelId}-hint`}
      hint={__('Sent to your analytics provider, so use no personal information. Leave blank for a neutral label. Save and publish to apply.', 'wconvert')}>
      <Input id={labelId} maxLength={80} value={preference?.label ?? ''} aria-describedby={`${labelId}-hint`} onChange={e => onChange({ ...preference, label: e.target.value })} />
    </Field>
  </div>;
}
