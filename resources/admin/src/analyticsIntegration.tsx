import { Suspense, type ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import type { SettingsEditing } from './settings-page/useSettingsEditing';
import { settingsHref } from './nav';
export interface CampaignAnalyticsProps { value: unknown; parentId?: string | null; onChange(value: unknown): void; }
export const analyticsIntegration: {
  settings?: ComponentType<{ onEditingStateChange?: SettingsEditing }>;
  campaign?: ComponentType<CampaignAnalyticsProps>;
} = {};
export function AnalyticsIntegrationSettings(props: { onEditingStateChange?: SettingsEditing }) {
  const Component = analyticsIntegration.settings;
  return Component ? <Suspense fallback={<p>{__('Loading analytics settings…', 'wconvert')}</p>}><Component {...props} /></Suspense>
    : <div><h2>{__('Analytics integrations', 'wconvert')}</h2><p>{__('Send campaign outcomes to your existing Google Analytics or Google Tag Manager setup with WConvert Pro. Native WConvert statistics remain available.', 'wconvert')}</p></div>;
}
export function CampaignAnalytics(props: CampaignAnalyticsProps) {
  const Component = analyticsIntegration.campaign;
  return <div className="wconvert-details-section"><h3>{__('External analytics', 'wconvert')}</h3>{Component
    ? <Suspense fallback={null}><Component {...props} /></Suspense>
    : <p>{__('Managed analytics integrations require Pro. Saved preferences remain inactive.', 'wconvert')}</p>}
    <a href={settingsHref('integrations')}>{__('Analytics integration settings', 'wconvert')}</a></div>;
}
