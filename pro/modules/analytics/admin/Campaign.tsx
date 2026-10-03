import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Input } from '@/components/ui/input';
import type { CampaignAnalyticsProps } from '@/analyticsIntegration';
import { editorHref } from '@/nav';
import { path, type Response } from './api';
export default function Campaign({ value, parentId, onChange }: CampaignAnalyticsProps) {
  const preference = value as { off?: boolean; label?: string } | undefined;
  const [enabled, setEnabled] = useState<boolean>();
  useEffect(() => { let active = true; apiFetch<Response>({ path }).then(v => { if (active) setEnabled(v.settings.enabled); }).catch(() => {}); return () => { active = false; }; }, []);
  if (parentId) return <p>{__('This variant uses its campaign family’s analytics preferences.', 'wconvert')} <a href={editorHref(parentId)}>{__('Open parent campaign', 'wconvert')}</a></p>;
  return <div className="flex flex-col gap-3">
    <label>{__('Analytics tracking', 'wconvert')}<select className="block w-full rounded-md border border-input bg-background px-3 py-2" value={preference?.off ? 'off' : 'site'} onChange={e => onChange({ ...preference, off: e.target.value === 'off' })}><option value="site">{__('Use site setting', 'wconvert')}</option><option value="off">{__('Off for this campaign', 'wconvert')}</option></select></label>
    <p className="text-note">{enabled === false ? __('Site integration is off. Saving this preference does not enable tracking.', 'wconvert') : enabled ? __('Published preferences apply when the site integration and consent policy allow tracking.', 'wconvert') : __('Check site settings for the current integration status.', 'wconvert')}</p>
    <label>{__('Public analytics label (optional)', 'wconvert')}<Input maxLength={80} value={preference?.label ?? ''} onChange={e => onChange({ ...preference, label: e.target.value })} /></label>
    <p className="text-note">{__('Sent to your analytics provider. Use no personal information. Leave blank for a neutral campaign label. Save and publish to apply.', 'wconvert')}</p>
  </div>;
}
