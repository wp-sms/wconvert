import { Suspense, lazy } from 'react';
import { __ } from '@wordpress/i18n';
import { BuilderSkeleton } from '../shell/BuilderSkeleton';
import { ChoiceSkeleton } from '../shell/ChoiceGrid';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import type { OptinBuilderProps } from './OptinBuilder';

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

const deferred = () => import('./deferred');

const Builder = lazy(() =>
  deferred().then((module) => ({ default: module.OptinBuilder })),
);

const Creation = lazy(() => deferred().then((module) => ({ default: module.GoalScreen })));

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
export function OptinBuilder({ id, onClose }: OptinBuilderProps) {
  return (
    <Suspense fallback={<BuilderSkeleton onClose={onClose} />}>
      <Builder id={id} onClose={onClose} />
    </Suspense>
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
 * So the fallback is step one as it draws itself mid-fetch: the region, its
 * title, and four cards in the shape of the four [[Goal]]s. Four because the
 * free install ships four; a fifth arriving makes this one card short for the
 * length of one fetch, which is a rounding error in a placeholder and not worth
 * a read to fix.
 */
export function GoalScreen({ onCreated }: { onCreated: (id: string) => void }) {
  return (
    <Suspense fallback={<CreationSkeleton />}>
      <Creation onCreated={onCreated} />
    </Suspense>
  );
}

function CreationSkeleton() {
  return (
    <Region>
      <RegionHeader
        title={__('Create an Optin', 'wconvert')}
        description={__('What do you want this Optin to do?', 'wconvert')}
      />
      <RegionBody>
        {/* The announcement travels with the skeleton now. */}
        <ChoiceSkeleton />
      </RegionBody>
    </Region>
  );
}
