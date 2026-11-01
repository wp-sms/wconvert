import { Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { lazyScreen } from './lib/requestActivity';
import { OccasionSkeleton } from './occasions/OccasionSkeleton';
import { sectionChunks } from './sectionLoaders';
import { ChunkBoundary } from './shell/ChunkBoundary';
import { DataTable } from './shell/DataTable';
import { Region } from './shell/Region';
import { RegionSkeleton } from './shell/RegionSkeleton';
import { Shell } from './shell/Shell';
import { StatRowSkeleton } from './shell/Stat';
import { TableSkeleton } from './shell/TableSkeleton';

/**
 * The reading sections, each in its own chunk (ADR 0038).
 *
 * Campaigns is the landing screen and stays in the main file; every other
 * section arrives when it is first shown. These are the eager half: {@see App}
 * renders them where it rendered the screens, and each owns what the merchant
 * sees while its code is on the way and if it never comes.
 *
 * - **Waiting** is the screen's own first loading state (GUIDELINES §12): the
 *   stat row Analytics draws, the table Leads draws, the settings card stack
 *   Destinations draws, a form's lines for Settings. So the chunk landing and
 *   the screen's first read are one placeholder, not two shapes in a row.
 * - **A chunk that never comes** — a tab left open across an update that
 *   deleted the file — is {@see ChunkBoundary}'s reload message inside the
 *   frame, never a blank page.
 * - **The download counts as in flight** ({@see lazyScreen}), so the header's
 *   bell still waits its turn.
 */

/** One section: its chunk, and what stands in for it until the chunk is here. */
// `any` as React's own `lazy` has it: a component's props are whatever it takes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function section<M, C extends ComponentType<any>>(load: () => Promise<M>, pick: (module: M) => C, fallback: () => ReactNode) {
  const Screen = lazyScreen(() => load().then((module) => ({ default: pick(module) })));
  return function Section(props: ComponentProps<C>) {
    return (
      <ChunkBoundary>
        <Suspense fallback={fallback()}>
          <Screen {...props} />
        </Suspense>
      </ChunkBoundary>
    );
  };
}

export const AnalyticsSection = section(
  sectionChunks.analytics,
  (module) => module.Dashboard,
  () => <RegionSkeleton label={__('Analytics', 'wconvert')}><StatRowSkeleton stats={4} /></RegionSkeleton>,
);

export const LeadsSection = section(
  sectionChunks.leads,
  (module) => module.LeadLog,
  () => <Region label={__('Submissions', 'wconvert')}><DataTable><TableSkeleton columns={5} /></DataTable></Region>,
);

export const SettingsSection = section(
  sectionChunks.settings,
  (module) => module.Settings,
  () => <RegionSkeleton label={__('Settings', 'wconvert')} lines={5} />,
);

export const SendingIssuesSection = section(
  sectionChunks.destinations,
  (module) => module.Destinations,
  () => <RegionSkeleton label={__('Destinations', 'wconvert')} lines={3} />,
);

const OccasionScreen = lazyScreen(() => sectionChunks.occasion().then((module) => ({ default: module.OccasionPage })));

/** The occasion page draws its own frame, so its fallbacks bring one. */
export function OccasionSection(props: ComponentProps<typeof OccasionScreen>) {
  return (
    <ChunkBoundary frame={(failed) => <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} hideDescription>{failed}</Shell>}>
      <Suspense fallback={<OccasionSkeleton />}><OccasionScreen {...props} /></Suspense>
    </ChunkBoundary>
  );
}
