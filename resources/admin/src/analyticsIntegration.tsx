import { Suspense, type ComponentType } from 'react';
import { Skeleton } from './components/ui/skeleton';
import { LineSkeleton } from './shell/LineSkeleton';
import { SettingsRegionSkeleton } from './settings-page/SettingsSkeleton';
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
  return Component ? <Suspense fallback={<SettingsRegionSkeleton region="integrations" />}><Component {...props} /></Suspense>
    : <Region><RegionHeader title={__('Analytics integrations', 'wconvert')} trailing={<Badge variant="secondary"><Lock aria-hidden="true" />{tierName('pro')}</Badge>} /><RegionBody><p className="m-0 text-note">{sprintf(/* translators: %s: the product that includes it, e.g. “WConvert Pro”. */ __('Send campaign events through your Google tag, GTM or Plausible with %s.', 'wconvert'), tierProductName('pro'))}</p></RegionBody></Region>;
}
/**
 * The section before its code: the choice, its two sentences and the label
 * field, or a variant's one sentence. Not a region: the form it stands for draws
 * no card, and it draws its own bar in the sentence that waits on a read.
 */
function CampaignAnalyticsSkeleton({ variant }: { variant: boolean }) {
  const status = __('Loading analytics preferences…', 'wconvert');
  if (variant) return <LineSkeleton status={status} />;
  return <div role="status" className="flex flex-col gap-3">
    <span className="sr-only">{status}</span>
    <div aria-hidden="true" className="grid gap-2"><Skeleton className="h-[1lh] w-32" /><Skeleton className="h-9 w-72 max-w-full" /></div>
    <div aria-hidden="true" className="grid gap-1.5 text-note"><Skeleton className="h-[1lh] w-full max-w-sm" /><Skeleton className="h-[1lh] w-full max-w-sm" /></div>
    <div aria-hidden="true" className="grid gap-1.5"><Skeleton className="h-[1lh] w-40" /><Skeleton className="h-9 w-full" /><Skeleton className="h-[1lh] w-full max-w-sm text-note" /></div>
  </div>;
}
export function CampaignAnalytics(props: CampaignAnalyticsProps) {
  const Component = analyticsIntegration.campaign;
  if (!Component && isFreeInstall()) return null;
  return <div className="wconvert-details-section"><h3>{__('Optional analytics', 'wconvert')}</h3>{Component
    ? <Suspense fallback={<CampaignAnalyticsSkeleton variant={Boolean(props.parentId)} />}><Component {...props} /></Suspense>
    : <><Badge variant="secondary"><Lock aria-hidden="true" />{tierName('pro')}</Badge><p>{sprintf(/* translators: %s: the product that includes it, e.g. “WConvert Pro”. */ __('Managed analytics integrations require %s. Saved preferences remain inactive.', 'wconvert'), tierProductName('pro'))}</p></>}
    <a href={settingsHref('integrations')}>{__('Analytics integration settings', 'wconvert')}</a></div>;
}
