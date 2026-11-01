import { Suspense, type ComponentProps, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ChunkBoundary } from './builder/lazy';
import { lazyScreen } from './lib/requestActivity';
import { OccasionSkeleton } from './occasions/OccasionFrame';
import { sectionChunks } from './sectionLoaders';
import { RegionSkeleton } from './shell/RegionSkeleton';
import { Shell } from './shell/Shell';

/**
 * The reading sections, each in its own chunk (ADR 0038).
 *
 * Campaigns is the landing screen and stays in the main file; every other
 * section arrives when it is first shown. These wrappers are the eager half:
 * {@see App} renders them as it rendered the real screens, and each owns what
 * the merchant sees while its code is on the way and if it never comes.
 *
 * - **Waiting** is the region skeleton Help uses, which each screen's own
 *   loading state takes over without a jump.
 * - **A chunk that never comes** — a tab left open across an update that
 *   deleted the file — is {@see ChunkBoundary}'s reload message inside the
 *   frame, never a blank page.
 * - **The download counts as in flight** ({@see lazyScreen}), so the header's
 *   bell still waits its turn.
 */

const DashboardScreen = lazyScreen(() => sectionChunks.analytics().then((module) => ({ default: module.Dashboard })));
const LeadLogScreen = lazyScreen(() => sectionChunks.leads().then((module) => ({ default: module.LeadLog })));
const SettingsScreen = lazyScreen(() => sectionChunks.settings().then((module) => ({ default: module.Settings })));
const DestinationsScreen = lazyScreen(() => sectionChunks.destinations().then((module) => ({ default: module.Destinations })));
const OccasionScreen = lazyScreen(() => sectionChunks.occasion().then((module) => ({ default: module.OccasionPage })));

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ChunkBoundary>
      <Suspense fallback={<RegionSkeleton label={label} lines={5} />}>{children}</Suspense>
    </ChunkBoundary>
  );
}

export function Dashboard(props: ComponentProps<typeof DashboardScreen>) {
  return <Section label={__('Analytics', 'wconvert')}><DashboardScreen {...props} /></Section>;
}

export function LeadLog(props: ComponentProps<typeof LeadLogScreen>) {
  return <Section label={__('Leads', 'wconvert')}><LeadLogScreen {...props} /></Section>;
}

export function Settings(props: ComponentProps<typeof SettingsScreen>) {
  return <Section label={__('Settings', 'wconvert')}><SettingsScreen {...props} /></Section>;
}

export function Destinations(props: ComponentProps<typeof DestinationsScreen>) {
  return <Section label={__('Sending issues', 'wconvert')}><DestinationsScreen {...props} /></Section>;
}

/** The occasion page draws its own frame, so its fallbacks bring one. */
export function OccasionPage(props: ComponentProps<typeof OccasionScreen>) {
  return (
    <ChunkBoundary frame={(failed) => <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} hideDescription>{failed}</Shell>}>
      <Suspense fallback={<OccasionSkeleton />}><OccasionScreen {...props} /></Suspense>
    </ChunkBoundary>
  );
}
