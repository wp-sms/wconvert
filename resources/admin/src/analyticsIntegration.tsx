import { Suspense, type ComponentType } from 'react';
import { RegionSkeleton } from './shell/RegionSkeleton';
import { Region, RegionBody, RegionHeader } from './shell/Region';
import { Lock } from 'lucide-react';
import { Badge } from './components/ui/badge';
import { isFreeInstall, tierName, tierProductName } from './goals/availability';
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
  // A free install is shown no locked feature (ADR 0116).
  if (!Component && isFreeInstall()) return null;
  return Component ? <Suspense fallback={<RegionSkeleton label={__('Analytics integrations', 'wconvert')} lines={4} />}><Component {...props} /></Suspense>
    : <Region><RegionHeader title={__('Analytics integrations', 'wconvert')} trailing={<Badge variant="secondary"><Lock aria-hidden="true" />{tierName('basic')}</Badge>} /><RegionBody><p className="m-0 text-note">{sprintf(__('Send campaign events through your existing Google tag, GTM or Plausible script with %s.', 'wconvert'), tierProductName('basic'))}</p></RegionBody></Region>;
}
export function CampaignAnalytics(props: CampaignAnalyticsProps) {
  const Component = analyticsIntegration.campaign;
  if (!Component && isFreeInstall()) return null;
  return <div className="wconvert-details-section"><h3>{__('Optional analytics', 'wconvert')}</h3>{Component
    ? <Suspense fallback={<RegionSkeleton label={__('External analytics', 'wconvert')} lines={2} />}><Component {...props} /></Suspense>
    : <><Badge variant="secondary"><Lock aria-hidden="true" />{tierName('basic')}</Badge><p>{sprintf(__('Managed analytics integrations require %s. Saved preferences remain inactive.', 'wconvert'), tierProductName('basic'))}</p></>}
    <a href={settingsHref('integrations')}>{__('Analytics integration settings', 'wconvert')}</a></div>;
}
