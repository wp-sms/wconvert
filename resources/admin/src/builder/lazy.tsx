import { Suspense } from 'react';
import { BackLink, BuilderSkeleton } from '../shell/BuilderSkeleton';
import { ChunkBoundary } from '../shell/ChunkBoundary';
import { GoalStepSkeleton } from '../goals/GoalStepSkeleton';
import type { OptinBuilderProps } from './OptinBuilder';
import type { GoalScreenProps } from '../goals/GoalScreen';
import { lazyScreen } from '../lib/requestActivity';
import { withRenderExtensions } from '../renderExtensions';

/**
 * ============================================================================
 * THE LAZY BOUNDARY. THIS IS THE PLACE HEAVY WORK LANDS (ADR 0038, #73).
 * ============================================================================
 * The four reading screens — Optins, Analytics, Leads, Destinations — need none
 * of the gallery, none of the settings panel and none of the renderer. The
 * builder needs all three, and the renderer is in this bundle at all precisely
 * because there are no static thumbnails (ADR 0010). So a merchant checking
 * yesterday's leads downloaded the whole editor and used none of it.
 *
 * Everything past this file is fetched when a merchant opens the builder or
 * starts creating an Optin, and never before. `builder/deferred.ts` is the
 * chunk; this file is the only thing that reaches it, and it reaches it exactly
 * once so there is exactly one chunk.
 *
 * **Anything heavy that arrives later belongs behind here** — that is the
 * consequence ADR 0038 recorded and the reason this is a named boundary rather
 * than two `React.lazy` calls in {@see App}. A canvas editor, a chart library,
 * a rich-text control: put it under `builder/` where only `deferred.ts` can
 * reach it, and the reading screens keep the size they have. The build prints
 * both halves separately, so a mistake here shows up as a number moving in the
 * pull request that caused it.
 *
 * **The two exports below are the eager half.** They are ordinary components
 * that happen to suspend, so {@see App} imports them exactly as it imported the
 * real ones and nothing above this file knows the boundary is here. Each owns
 * its own fallback, because a fallback belongs to the screen it stands in for
 * and there is no such thing as a generic one.
 */

// With the renderer's extensions (Pro's journeys), which the builder draws with.
const deferred = () => withRenderExtensions(import('./deferred'));

// Through `lazyScreen`, so the header's bell waits for the download as it waits for a read (#395).
const Builder = lazyScreen(() =>
  deferred().then((module) => ({ default: module.OptinBuilder })),
);

const Creation = lazyScreen(() => deferred().then((module) => ({ default: module.GoalScreen })));

/**
 * The builder, with the builder's own skeleton over the wait.
 *
 * The fallback is the SAME component {@see OptinBuilder} draws while its first
 * fetch is in flight, so the chunk landing changes nothing on screen: the
 * merchant sees one placeholder from the click until the Optin arrives, rather
 * than a placeholder, a flash, and a second placeholder.
 *
 * It carries `onClose` for the same reason the skeleton does — the way out has
 * to work before the chunk lands, and the control that leaves cannot be inside
 * the chunk it is waiting for.
 */
export function OptinBuilder(props: OptinBuilderProps) {
  return (
    <ChunkBoundary way={<BackLink className="wconvert-builder-skeleton__back" onClose={props.onClose} label={props.backLabel} />}>
      <Suspense fallback={<BuilderSkeleton onClose={props.onClose} backLabel={props.backLabel} />}>
        <Builder {...props} />
      </Suspense>
    </ChunkBoundary>
  );
}

/**
 * The goal-first creation flow, with step one's own skeleton over the wait.
 *
 * **Loading is a state and never the empty state** (ADR 0039), and this is the
 * screen that taught the rule: step 2 once read *"No ready-to-run starts for
 * this Goal yet"* while its Playbooks were still in flight. A blank frame here
 * would be the same failure a step earlier — the merchant has clicked *Create
 * an Optin* and is owed the shape of what is coming.
 *
 * So the fallback is {@see GoalStepSkeleton}, the component step one itself
 * draws while its goals are read: one shape from the click until the goals
 * land, with the step nav and heading already where they will stay.
 */
export function GoalScreen(props: GoalScreenProps) {
  return (
    <ChunkBoundary>
      <Suspense fallback={<GoalStepSkeleton />}>
        <Creation {...props} />
      </Suspense>
    </ChunkBoundary>
  );
}
