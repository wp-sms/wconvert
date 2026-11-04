import { Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { DestinationsSkeleton } from './destinations/DestinationsSkeleton';
import { LeadLogSkeleton } from './leads/LeadLogSkeleton';
import { lazyScreen } from './lib/requestActivity';
import { OccasionSkeleton } from './occasions/OccasionSkeleton';
import { sectionChunks } from './sectionLoaders';
import { SettingsSkeleton } from './settings-page/SettingsSkeleton';
import { ChunkBoundary } from './shell/ChunkBoundary';
import { Shell } from './shell/Shell';
import { isReportOverview } from './nav';
import { AnalyticsSkeleton, ReportBack, ReportHeadingSkeleton } from './stats/AnalyticsSkeleton';

/**
 * The reading sections, each in its own chunk (ADR 0038).
 *
 * Campaigns is the landing screen and stays in the main file; every other
 * section arrives when it is first shown. These are the eager half: {@see App}
 * renders them where it rendered the screens, and each owns what the merchant
 * sees while its code is on the way and if it never comes.
 *
 * - **Waiting is ONE component, drawn twice** (GUIDELINES §12). Each fallback
 *   is the very component its screen draws on its own first read —
 *   {@see AnalyticsSkeleton}, {@see LeadLogSkeleton}, {@see SettingsSkeleton},
 *   {@see DestinationsSkeleton}, {@see OccasionSkeleton} — kept outside the
 *   chunk and imported back by the screen. So the chunk landing and the first
 *   read are one placeholder, not two shapes in a row. A fallback is handed the
 *   screen's props, because Settings' shape depends on the group it opens.
 * - **A chunk that never comes** — a tab left open across an update that
 *   deleted the file — is {@see ChunkBoundary}'s reload message inside the
 *   frame, never a blank page.
 * - **The download counts as in flight** ({@see lazyScreen}), so the header's
 *   bell still waits its turn.
 */

/** One section: its chunk, and what stands in for it until the chunk is here. */
// `any` as React's own `lazy` has it: a component's props are whatever it takes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function section<M, C extends ComponentType<any>>(load: () => Promise<M>, pick: (module: M) => C, fallback: (props: ComponentProps<C>) => ReactNode) {
  const Screen = lazyScreen(() => load().then((module) => ({ default: pick(module) })));
  return function Section(props: ComponentProps<C>) {
    return (
      <ChunkBoundary>
        <Suspense fallback={fallback(props)}>
          <Screen {...props} />
        </Suspense>
      </ChunkBoundary>
    );
  };
}

export const AnalyticsSection = section(sectionChunks.analytics, (module) => module.Dashboard, (props) => <>
  {props?.query && !isReportOverview(props.query) && <><ReportBack query={props.query} /><ReportHeadingSkeleton query={props.query} /></>}
  <AnalyticsSkeleton />
</>);

export const LeadsSection = section(sectionChunks.leads, (module) => module.LeadLog, () => <LeadLogSkeleton />);

export const SettingsSection = section(sectionChunks.settings, (module) => module.Settings, (props) => <SettingsSkeleton group={props.group} />);

export const SendingIssuesSection = section(sectionChunks.destinations, (module) => module.Destinations, () => <DestinationsSkeleton mode="issues" />);

const OccasionScreen = lazyScreen(() => sectionChunks.occasion().then((module) => ({ default: module.OccasionPage })));

/** The occasion page draws its own frame, so its fallbacks bring one. */
export function OccasionSection(props: ComponentProps<typeof OccasionScreen>) {
  return (
    <ChunkBoundary frame={(failed) => <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} hideDescription>{failed}</Shell>}>
      <Suspense fallback={<OccasionSkeleton />}><OccasionScreen {...props} /></Suspense>
    </ChunkBoundary>
  );
}
