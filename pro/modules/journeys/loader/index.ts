import { notifyCampaign } from '@loader/events';
import type { LoaderModule } from '@loader/types';
import type { Mounted } from '@renderer/mount';
import type { OptinControls, PayloadEntry } from '@loader/types';
import { bindJourney } from './journey';
import { registerPremiumJourneyRenderer } from './render';

registerPremiumJourneyRenderer();

export function premiumCaptureInto(mounted: Mounted, entry: PayloadEntry, controls: OptinControls): void {
  bindJourney(mounted, entry, { onLeadAccepted: () => notifyCampaign(entry, 'capture'), onCaptured: () => controls.convert(), onCompleted: () => controls.convert(), onDismiss: () => controls.dismiss() });
}

/** Journeys contribute a presenter and templates rather than a display rule. */
export const JOURNEY_MODULES: readonly LoaderModule[] = [];
