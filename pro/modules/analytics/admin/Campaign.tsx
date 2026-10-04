import { useEffect, useId, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RegionErrorState } from '@/shell/Region';
import { RegionSkeleton } from '@/shell/RegionSkeleton';
import { failed, type Loadable } from '@/shell/loadable';
import type { CampaignAnalyticsProps } from '@/analyticsIntegration';
import { editorHref } from '@/nav';
import { path, type Response } from './api';
export default function Campaign({ value, parentId, onChange }: CampaignAnalyticsProps) {
  const preference = value as { off?: boolean; label?: string } | undefined;
  const choiceId = useId();
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
  if (parentId) return <p>{__('This variant uses its campaign family’s analytics preferences.', 'wconvert')} <a href={editorHref(parentId)}>{__('Open parent campaign', 'wconvert')}</a></p>;
  return <div className="flex flex-col gap-3">
    <div className="grid gap-2"><span id={choiceId}>{__('Analytics tracking', 'wconvert')}</span>
      <div role="group" aria-labelledby={choiceId} className="wconvert-option-strip">
        <label><input type="radio" name={choiceId} checked={!preference?.off} onChange={() => onChange({ ...preference, off: false })} />{__('Use site setting', 'wconvert')}</label>
        <label><input type="radio" name={choiceId} checked={!!preference?.off} onChange={() => onChange({ ...preference, off: true })} />{__('Off for this campaign', 'wconvert')}</label>
      </div>
    </div>
    {enabled.status === 'loading' ? <RegionSkeleton label={__('Site analytics', 'wconvert')} lines={1} />
      : enabled.status === 'failed' ? <RegionErrorState message={enabled.message}
        action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />
        : <p className="text-note">{enabled.data ? __('Published preferences apply to enabled external analytics and campaign sales, subject to consent.', 'wconvert') : __('External analytics is off. Campaign sales has a separate site setting.', 'wconvert')}</p>}
    <p className="text-note">{__('Off excludes this campaign from external analytics and sales attribution. Native result counts continue.', 'wconvert')}</p>
    <label>{__('Public analytics label (optional)', 'wconvert')}<Input maxLength={80} value={preference?.label ?? ''} onChange={e => onChange({ ...preference, label: e.target.value })} /></label>
    <p className="text-note">{__('Sent to your analytics provider. Use no personal information. Leave blank for a neutral campaign label. Save and publish to apply.', 'wconvert')}</p>
  </div>;
}
