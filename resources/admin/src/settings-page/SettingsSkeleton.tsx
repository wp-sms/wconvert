import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { DestinationsSkeleton } from '../destinations/DestinationsSkeleton';
import { isFreeInstall } from '../goals/availability';
import type { SettingsGroup } from '../nav';
import { catalogConfigured } from '../settings';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { SwitchSettingSkeleton } from '../shell/SwitchSettingSkeleton';
import { useShownAfterDelay } from '../shell/skeletonDelay';

/**
 * Settings before its code or its values: the category rail and the 900px
 * column, with each region of the chosen group in its own loading shape.
 *
 * ============================================================================
 * EVERY REGION'S LOADING SHAPE IS DEFINED HERE, ONCE.
 * ============================================================================
 * {@see SettingsSection} draws this while the Settings chunk downloads, and
 * each region of the loaded page draws its own part of it
 * ({@see SettingsRegionSkeleton}) while it reads its values. One definition
 * for both waits is what keeps them one shape: a full-width card stood in for
 * a rail, a column and up to six regions before, and the page was rebuilt when
 * the chunk landed.
 *
 * The rail's six links are bars rather than words because the free install
 * has five and the rail is in the chunk; the column is the part that matters.
 */
export function SettingsSkeleton({ group }: { group: SettingsGroup }) {
  const links = isFreeInstall() ? 5 : 6;
  return (
    <div className="grid min-w-0 items-start gap-7 max-lg:gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div aria-hidden="true" className="min-w-0">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Skeleton className="w-full sm:w-56 lg:hidden" style={{ blockSize: 'var(--control-height)' }} />
          <Skeleton className="w-full min-w-0 sm:flex-1 lg:flex-none" style={{ blockSize: 'var(--control-height)' }} />
        </div>
        {Array.from({ length: links }, (_each, link) => (
          <div key={link} className="my-[7px] flex gap-3 rounded-sm border border-transparent px-3 py-[15px] max-lg:hidden">
            <Skeleton className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <Skeleton className="block h-[1lh] w-full max-w-40" />
              <Skeleton className="mt-1 block h-[1lh] w-full max-w-48 text-note" />
            </span>
          </div>
        ))}
      </div>
      <div className="min-w-0 max-w-[900px]">
        <SettingsGroupSkeleton group={isFreeInstall() && group === 'integrations' ? 'connections' : group} />
      </div>
    </div>
  );
}

/** The regions of one group, in the order and spacing the group draws them. */
function SettingsGroupSkeleton({ group }: { group: SettingsGroup }) {
  switch (group) {
    case 'connections':
      return <div className="grid gap-6"><DestinationsSkeleton mode="settings" /><SwitchSettingSkeleton title={__('AI agents', 'wconvert')} /></div>;
    case 'experience':
      return <div className="grid gap-6"><SettingsRegionSkeleton region="allowance" /><SettingsRegionSkeleton region="phone" /></div>;
    case 'protection':
      return <SettingsRegionSkeleton region="spam" />;
    case 'data':
      return <div className="flex flex-col gap-4">
        <SettingsRegionSkeleton region="retention" />
        <SettingsRegionSkeleton region="dataMap" />
        <RegionSkeleton label={__('Export and personal data', 'wconvert')}>
          <Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-72" />
          <div aria-hidden="true" className="flex flex-col gap-1 border-t border-border pt-3">
            <Skeleton className="h-[1lh] w-44" />
            <Skeleton className="h-[1lh] w-full max-w-2xl text-note" />
            <Skeleton className="h-[1lh] w-2/3 max-w-xl text-note" />
            <Skeleton className="h-[1lh] w-full max-w-80 text-note" />
          </div>
        </RegionSkeleton>
        <SwitchSettingSkeleton title={__('Privacy guidance', 'wconvert')} />
        <SwitchSettingSkeleton title={__('Google Fonts', 'wconvert')} />
        {catalogConfigured() && <SwitchSettingSkeleton title={__('Online template library', 'wconvert')} />}
      </div>;
    case 'reports':
      return <SettingsRegionSkeleton region="reports" />;
    case 'integrations':
      return <SettingsRegionSkeleton region="integrations" />;
  }
}

/**
 * One settings region while its values are read. The region draws this
 * itself, and {@see SettingsSkeleton} draws it for the chunk's wait.
 */
export function SettingsRegionSkeleton({ region }: { region: 'allowance' | 'phone' | 'spam' | 'retention' | 'dataMap' | 'reports' | 'integrations' }) {
  switch (region) {
    case 'allowance':
      return <RegionSkeleton label={__('Display limits', 'wconvert')} description lines={4} footer />;
    case 'phone':
      return <RegionSkeleton label={__('Phone input', 'wconvert')} description lines={1} footer />;
    case 'spam':
      // Two regions, as the loaded page has: the protection form and its activity.
      return <div className="grid gap-6">
        <RegionSkeleton label={__('Spam protection', 'wconvert')} description
          trailing={<Skeleton aria-hidden="true" className="h-[1lh] w-40 text-note" />} lines={3} footer />
        <RegionSkeleton label={__('Protection activity', 'wconvert')} description lines={2} />
      </div>;
    case 'retention':
      // The scope line, the two radio cards under their legend, and Save.
      return <RegionSkeleton label={__('How long submissions are kept', 'wconvert')} description footer>
        <div className="flex flex-col gap-3">
          <Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-2xl text-note" />
          <Skeleton aria-hidden="true" className="mb-4 mt-2 h-[1lh] w-32" />
          <Skeleton aria-hidden="true" className="h-[46px] w-full" />
          <Skeleton aria-hidden="true" className="h-[68px] w-full" />
        </div>
      </RegionSkeleton>;
    case 'dataMap':
      return <DataMapSkeleton />;
    case 'reports':
      return <RegionSkeleton label={__('Weekly summary email', 'wconvert')} description lines={3} footer />;
    case 'integrations':
      return <RegionSkeleton label={__('Analytics integrations', 'wconvert')} description lines={4} footer />;
  }
}

/**
 * The data map is a closed card disclosure — a title, a one-line summary and
 * its chevron — so that is what stands in for it, not an open region of
 * five lines that collapses to one row when it lands.
 */
function DataMapSkeleton() {
  if (!useShownAfterDelay()) return null;
  return (
    <div className="wconvert-disclosure wconvert-disclosure--card wconvert-data-map">
      <span role="status" className="sr-only">{__('Loading what visitor data is stored…', 'wconvert')}</span>
      <div aria-hidden="true" className="grid min-h-11 grid-cols-[minmax(0,1fr)_16px] items-center gap-2.5 px-3 py-2.5">
        <span className="min-w-0">
          <Skeleton className="block h-[1lh] w-full max-w-56" />
          <Skeleton className="mt-0.5 block h-[1lh] w-full max-w-72 text-note" />
        </span>
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}
