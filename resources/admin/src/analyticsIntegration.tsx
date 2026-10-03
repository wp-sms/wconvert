import { Suspense, type ComponentType } from 'react';
import { RegionSkeleton } from './shell/RegionSkeleton';
import { Region, RegionBody, RegionHeader } from './shell/Region';
import { Lock } from 'lucide-react';
import { Badge } from './components/ui/badge';
import { tierName, tierProductName } from './goals/availability';
import { __, sprintf } from '@wordpress/i18n';
import type { SettingsEditing } from './settings-page/useSettingsEditing';
import { settingsHref } from './nav';
export interface CampaignAnalyticsProps { value: unknown; parentId?: string | null; onChange(value: unknown): void; }
export const analyticsIntegration: {
  settings?: ComponentType<{ onEditingStateChange?: SettingsEditing }>;
  campaign?: ComponentType<CampaignAnalyticsProps>;
} = {};
export function AnalyticsIntegrationSettings(props: { onEditingStateChange?: SettingsEditing }) {
  const Component = analyticsIntegration.settings;
  return Component ? <Suspense fallback={<RegionSkeleton label={__('Google Analytics 4', 'wconvert')} lines={4} />}><Component {...props} /></Suspense>
    : <Region><RegionHeader title={__('Google Analytics 4', 'wconvert')} trailing={<Badge variant="secondary"><Lock aria-hidden="true" />{tierName('basic')}</Badge>} /><RegionBody><p className="m-0 text-note">{sprintf(__('Send campaign events through your existing Google tag or GTM with %s.', 'wconvert'), tierProductName('basic'))}</p></RegionBody></Region>;
}
export function CampaignAnalytics(props: CampaignAnalyticsProps) {
  const Component = analyticsIntegration.campaign;
  return <div className="wconvert-details-section"><h3>{__('External analytics', 'wconvert')}</h3>{Component
    ? <Suspense fallback={null}><Component {...props} /></Suspense>
    : <p>{__('Managed analytics integrations require Pro. Saved preferences remain inactive.', 'wconvert')}</p>}
    <a href={settingsHref('integrations')}>{__('Analytics integration settings', 'wconvert')}</a></div>;
}
